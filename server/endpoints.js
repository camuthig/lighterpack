const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const generate = require('nanoid/generate');

const router = express.Router();
const fs = require('fs');
const request = require('request');
const formidable = require('formidable');
const mongojs = require('mongojs');
const config = require('config');
const awesomeLog = require('./log.js');

const { authenticateUser, loadMongoUser, verifyPassword } = require('./auth.js');

if (config.get('mailgunAPIKey')) {
    var mailgun = require('mailgun-js')({ apiKey: config.get('mailgunAPIKey'), domain: config.get('mailgunDomain') });
}

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const dataTypes = require('../client/dataTypes.js');

const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

// one day in many years this can go away.
eval(`${fs.readFileSync(path.join(__dirname, './sha3.js'))}`);

router.post('/register', async (req, res) => {
    registerUser(req, res);
});

async function registerUser(req, res) {
    let username = String(req.body.username).toLowerCase().trim();
    const password = String(req.body.password);
    let email = String(req.body.email);

    const errors = [];

    if (!username) {
        errors.push({ field: 'username', message: 'Please enter a username.' });
    }

    if (username && (username.length < 3 || username.length > 32)) {
        errors.push({ field: 'username', message: 'Please enter a username between 3 and 32 characters.' });
    }

    if (!email) {
        errors.push({ field: 'email', message: 'Please enter an email.' });
    }

    email = email.trim();

    if (!password) {
        errors.push({ field: 'password', message: 'Please enter a password.' });
    }

    if (password && (password.length < 5 || password.length > 60)) {
        errors.push({ field: 'password', message: 'Please enter a password between 5 and 60 characters.' });
    }

    if (errors.length) {
        return res.status(400).json({ errors });
    }

    awesomeLog(req, username);

    try {
        let existingUser = await prisma.user.findFirst({ where: { username } });
        if (existingUser) {
            awesomeLog(req, 'User exists.');
            return res.status(400).json({ errors: [{ field: 'username', message: 'That username already exists, please pick a different username.' }] });
        }


        existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) {
            awesomeLog(req, 'User email exists.');
            return res.status(400).json({ errors: [{ field: 'email', message: 'A user with that email already exists.' }] });
        }
    } catch (err) {
        awesomeLog(req, err);
        return res.status(500).json({ message: 'An error occurred. Please try again later.'})
    }

    bcrypt.genSalt(10, async (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            crypto.randomBytes(48, async (ex, buf) => {
                const token = buf.toString('hex');
                let library;
                if (req.body.library) {
                    try {
                        library = JSON.parse(req.body.library);
                    } catch (e) {
                        return res.status(400).json({ errors: [{ message: 'Unable to parse your library. Contact support.' }] });
                    }
                } else {
                    library = new Library().save();
                }

                awesomeLog(req, 'Creating new user in Postgres');
                await prisma.user.create({
                    data: {
                        username,
                        passwordHash: hash,
                        email,
                        token,
                        syncToken: 0,
                    },
                });

                const newUser = {
                    username,
                    password: hash,
                    email,
                    token,
                    library,
                    syncToken: 0,
                };
                awesomeLog(req, 'Saving new user library to Mongo.');
                await db.users.save(newUser);
                awesomeLog(req, newUser);
                const out = { username, library: JSON.stringify(newUser.library), syncToken: 0 };
                res.cookie('lp', token, { path: '/', maxAge: 365 * 24 * 60 * 1000 });
                return res.status(200).json(out);
            });
        });
    });
}

router.post('/signin', async (req, res) => {
    authenticateUser(req, res, returnLibrary);
});

function returnLibrary(req, res, user) {
    awesomeLog(req, user.username);
    return loadMongoUser(req, res, user, function (mongoUser) {
        if (!mongoUser.syncToken) {
            mongoUser.syncToken = 0;
            db.users.save(mongoUser);
        }
        return res.json({ username: user.username, library: JSON.stringify(mongoUser.library), syncToken: mongoUser.syncToken });
    });
}

router.post('/saveLibrary', (req, res) => {
    authenticateUser(req, res, saveLibrary);
});

function saveLibrary(req, res, user) {
    return loadMongoUser(req, res, user, function(mongoUser) {
        if (typeof req.body.syncToken === 'undefined') {
            return res.status(400).send("Please refresh this page to upgrade to the latest version of LighterPack.");
        }
        if (!req.body.username || !req.body.data) {
            return res.status(400).json({ message: 'An error occurred while saving your data. Please refresh your browser and try again.' });
        }

        if (req.body.username != user.username) {
            return res.status(401).json({ message: 'An error occurred while saving your data. Please refresh your browser and login again.' });
        }

        if (req.body.syncToken != mongoUser.syncToken) {
            return res.status(400).json({ message: 'Your list is out of date - please refresh your browser.' });
        }

        let library;
        try {
            library = JSON.parse(req.body.data);
        } catch (e) {
            return res.status(400).json({ errors: [{ message: 'An error occurred while saving your data - unable to parse library. If this persists, please contact support.' }] });
        }

        mongoUser.library = library;
        mongoUser.syncToken++;
        return db.users.save(mongoUser, () => {
            awesomeLog(req, user.username);

            return res.status(200).json({ message: 'success', syncToken: mongoUser.syncToken });
        });
    });
}

router.post('/externalId', (req, res) => {
    authenticateUser(req, res, externalId);
});

function externalId(req, res, user) {
    const id = generate('1234567890abcdefghijklmnopqrstuvwxyz', 6);
    awesomeLog(req, `Id generated: ${id}`);

    db.users.find({ 'library.lists.externalId': id }, (err, users) => {
        if (err) {
            awesomeLog(req, `Id lookup error for id: ${id}`);
            res.status(500).send('An error occurred.');
            return;
        }

        if (!users.length) {
            loadMongoUser(req, res, user, function (mongoUser) {
                if (typeof user.externalIds === 'undefined') user.externalIds = [id];
                else user.externalIds.push(id);
                db.users.save(mongoUser);
                awesomeLog(req, `Id: ${id} saved for user ${user.username}`);
                res.status(200).json({ externalId: id });
            });
        } else {
            awesomeLog(req, `Id collision detected for id: ${id}`);
            externalId(req, res, user);
        }
    });
}

router.post('/forgotPassword', async (req, res) => {
    awesomeLog(req);
    let username = String(req.body.username).toLowerCase().trim();
    if (!username || username.length < 1 || username.length > 32) {
        awesomeLog(req, `Bad forgot password:${username}`);
        return res.status(400).json({ errors: [{ message: 'Please enter a username.' }] });
    }

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        awesomeLog(req, `Forgot password for unknown user:${username}`);
        return res.status(500).json({ message: 'An error occurred.' });
    }

    require('crypto').randomBytes(12, async (ex, buf) => {
        const newPassword = buf.toString('hex');

        bcrypt.genSalt(10, async (err, salt) => {
            bcrypt.hash(newPassword, salt, async (err, hash) => {
                const email = user.email;

                const message = `Hello ${username},\n Apparently you forgot your password. Here's your new one: \n\n Username: ${username}\n Password: ${newPassword}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

                const mailOptions = {
                    from: 'LighterPack <info@mg.lighterpack.com>',
                    to: email,
                    "h:Reply-To": "LighterPack <info@lighterpack.com>",
                    subject: 'Your new LighterPack password',
                    text: message,
                };

                awesomeLog(req, `Attempting to send new password to:${email}`);
                if (mailgun) {
                    try {
                        const response = await mailgun.messages().send(mailOptions);
                        awesomeLog(req, `Message sent: ${response.message}`);
                    } catch (err) {
                        awesomeLog(req, error);
                        return res.status(500).json({ message: 'An error occurred' });
                    }
                } else {
                    awesomeLog(req, 'Not sending message because mailgun is not configured');
                    awesomeLog(req, mailOptions);
                }

                await prisma.user.update({
                    where: {
                        id: user.id,
                    },
                    data: {
                        passwordHash: hash,
                    },
                });

                const out = { username };
                awesomeLog(req, `password changed for user:${username}`);
                return res.status(200).json(out);
            });
        });
    });
});

router.post('/forgotUsername', async (req, res) => {
    let email = String(req.body.email).toLowerCase().trim();
    if (!email || email.length < 1) {
        awesomeLog(req, `Bad forgot username:${email}`);
        return res.status(400).json({ errors: [{ message: 'Please enter a valid email.' }] });
    }

    let user = null;

    try {
        user = await prisma.user.findFirst({
            where: {
                email: email,
            },
        });
    } catch (err) {
        awesomeLog(req, `Forgot email lookup error for:${email}`);
        return res.status(500).json({ message: 'An error occurred' });
    }

    if (!user) {
        awesomeLog(req, `Forgot email for unknown user:${email}`);
        return res.status(400).json({ message: 'An error occurred' });
    }

    const username = user.username;

    const message = `Hello ${username},\n Apparently you forgot your username. Here It is: \n\n Username: ${username}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

    const mailOptions = {
        from: 'LighterPack <info@mg.lighterpack.com>',
        to: email,
        "h:Reply-To": "LighterPack <info@lighterpack.com>",
        subject: 'Your LighterPack username',
        text: message,
    };

    awesomeLog(req, `Attempting to send username to:${email}`);
    if (mailgun) {
        try {
            const response = await mailgun.messages().send(mailOptions);
            awesomeLog(req, `Message sent: ${response.message}`);
        } catch (err) {
            awesomeLog(req, error);
            return res.status(500).json({ message: 'An error occurred' });
        }
    } else {
        awesomeLog(req, 'Not sending message because mailgun is not configured');
        awesomeLog(req, mailOptions);
    }

    const out = { email };
    awesomeLog(req, `sent username message for user:${username}`);
    return res.status(200).json(out);
});

router.post('/account', (req, res) => {
    authenticateUser(req, res, account);
});

async function account(req, res, user) {
    // TODO: check for duplicate emails

    verifyPassword(user.username, String(req.body.currentPassword))
        .then((user) => {
            if (req.body.newPassword) {
                const newPassword = String(req.body.newPassword);
                const errors = [];

                if (newPassword.length < 5 || newPassword.length > 60) {
                    errors.push({ field: 'newPassword', message: 'Please enter a password between 5 and 60 characters.' });
                }

                if (errors.length) {
                    return res.status(400).json({ errors });
                }

                bcrypt.genSalt(10, async (err, salt) => {
                    bcrypt.hash(newPassword, salt, async (err, hash) => {
                        user.passwordHash = hash;
                        awesomeLog(req, `Changing PW - ${user.username}`);

                        if (req.body.newEmail) {
                            user.email = String(req.body.newEmail);
                            awesomeLog(req, `Changing Email - ${user.username}`);
                        }

                        await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                passwordHash: user.passwordHash,
                                email: user.email,
                            },
                        })
                        return res.status(200).json({ message: 'success' });
                    });
                });
            } else if (req.body.newEmail) {
                awesomeLog(req, `Changing Email - ${user.username}`);
                prisma.user.update({
                    where: { id: user.id },
                    data: { email: String(req.body.newEmail) },
                })
                return res.status(200).json({ message: 'success' });
            }
        })
        .catch((err) => {
            res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
        });
}

router.post('/delete-account', (req, res) => {
    authenticateUser(req, res, deleteAccount);
});

async function deleteAccount(req, res, user) {
    verifyPassword(user.username, String(req.body.password))
        .then(async (user) => {
            if (req.body.username !== user.username) {
                return Promise.reject(new Error('An error occurred, please try logging out and in again.'));
            }

            try {
                await prisma.user.delete({ where: { id: user.id } });
                loadMongoUser(req, res, user, async (mongoUser) => {
                    await db.users.remove(mongoUser, true);
                })
            } catch (err) {
                return res.status(500).json({ message: 'An error occurred, please try again later.'});
            }

            return res.status(200).json({ message: 'success' });
        })
        .catch((err) => {
            awesomeLog(req, err);
            res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
        });
}

router.post('/imageUpload', (req, res) => {
    // authenticateUser(req, res, imageUpload);
    awesomeLog(req);
    imageUpload(req, res, {});
});

function imageUpload(req, res, user) {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        if (err) {
            awesomeLog(req, 'form parse error');
            return res.status(500).json({ message: 'An error occurred' });
        }
        if (!files || !files.image) {
            awesomeLog(req, 'No image in upload');
            return res.status(500).json({ message: 'An error occurred' });
        }

        const path = files.image.path;
        const imgurRequest = request.defaults({ json: true });
        fs.readFile(path, (e, img_data) => {
            const temp = { uri: 'https://api.imgur.com/3/image', headers: { Authorization: `Client-ID ${config.get('imgurClientID')}` } };
            temp.body = img_data.toString('base64');
            imgurRequest.post(temp, (e, r, body) => {
                if (e) {
                    awesomeLog(req, 'imgur post fail!');
                    awesomeLog(req, e);
                    awesomeLog(req, body);
                    return res.status(500).json({ message: 'An error occurred.' });
                } if (!body) {
                    awesomeLog(req, 'imgur post fail!!');
                    awesomeLog(req, e);
                    return res.status(500).json({ message: 'An error occurred.' });
                } if (r.statusCode !== 200 || body.error) {
                    awesomeLog(req, 'imgur post fail!!!');
                    awesomeLog(req, e);
                    awesomeLog(req, body);
                    return res.status(500).json({ message: 'An error occurred.' });
                }
                awesomeLog(req, body);
                return res.send(body);
            });
        });
    });
}

module.exports = router;
