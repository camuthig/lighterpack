const fs = require('fs');
const path = require('path');
const config = require('config');
const awesomeLog = require('./log.js');

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongojs = require('mongojs');

const moderatorList = config.get('moderators')


const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()


const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

// one day in many years this can go away.
eval(`${fs.readFileSync(path.join(__dirname, './sha3.js'))}`);

const authenticateModerator = function(req, res, next, callback) {
    try {
        authenticateUser(req, res, next, (req, res, user) => {
            if (!isModerator(user.username)) {
                return res.status(403).json({ message: 'Denied.' });
            }
            callback(req, res, user);
        });
    } catch (err) {
        next(err);
    }
}

const authenticateUser = async function(req, res, next, callback) {
    if (!req.cookies.lp && (!req.body.username || !req.body.password)) {
        return res.status(401).json({ message: 'Please log in.' });
    }
    if (req.body.username && req.body.password) {
        const username = String(req.body.username).toLowerCase().trim();
        const password = String(req.body.password);
        verifyPassword(username, password)
            .then(async (user) => {
                await generateSession(req, res, user, callback);
            })
            .catch((err) => {
                console.log(err);
                if (err.code && err.message) {
                    awesomeLog(req, err.message);
                    res.status(err.code).json({ message: err.message });
                } else {
                    res.status(500).json({ message: 'An error occurred, please try again later.' });
                }
            });
    } else {
        let user = await prisma.user.findUnique({ where: { token: req.cookies.lp } });
        if (!user) {
            awesomeLog(req, 'bad cookie!');
            return res.status(404).json({ message: 'Please log in again.' });
        }

        try {
            callback(req, res, user);
        } catch (err) {
            next(err);
        }
    }
}

const verifyPassword = async function(username, password) {
    return new Promise(async (resolve, reject) => {
        let user = await prisma.user.findUnique({ where: { username } });

        if (!user) {
            return reject({ code: 404, message: 'Invalid username and/or password.' });
        }

        bcrypt.compare(password, user.passwordHash, (err, result) => {
            if (err) {
                return reject({ code: 500, message: 'An error occurred, please try again later.' });
            }
            if (!result) {
                const sha3password = CryptoJS.SHA3(password + username).toString(CryptoJS.enc.Base64);
                bcrypt.compare(sha3password, user.passwordHash, (err, result) => {
                    if (err) {
                        reject({ code: 500, message: 'An error occurred, please try again later.' });
                    }
                    if (!result) {
                        /* TODO: reinstate this block after DB migration */
                        /* reject({code: 404, message: "Invalid username and/or password."}); */

                        /* TODO: remove this block after DB migration */
                        if (sha3password === user.passwordHash) {
                            resolve(user);
                        } else {
                            /* TODO: revert this error message by removing refresh text */
                            reject({ code: 404, message: 'Invalid username and/or password. Please refresh the page before trying again.' });
                        }
                    } else {
                        // Remove extra layer of hashing. Just bcrypt.
                        bcrypt.genSalt(10, async (err, salt) => {
                            if (err) {
                                return reject({ code: 500, message: 'An error occurred, please try again later.' });
                            }
                            bcrypt.hash(password, salt, async (err, hash) => {
                                if (err) {
                                    return reject({ code: 500, message: 'An error occurred, please try again later.' });
                                }

                                await prisma.user.update({
                                    where: { id: user.id },
                                    data: { passwordHash: hash },
                                });

                                resolve(user);
                            });
                        });
                    }
                });
            } else {
                resolve(user);
            }
        });
    });
}

const generateSession= async function(req, res, user, callback) {
    crypto.randomBytes(48, async (ex, buf) => {
        const token = buf.toString('hex');

        await prisma.user.update({
            where: { id: user.id },
            data: { token },
        });

        res.cookie('lp', token, { path: '/', maxAge: 365 * 24 * 60 * 1000 });
        callback(req, res, user);
    });
}


function isModerator(username) {
    return moderatorList.indexOf(username) > -1;
}

async function loadMongoUser(req, res, user, callback) {
    db.users.find({ username: user.username }, (err, users) => {
        if (err) {
            awesomeLog(req, `Error loading user from Mongo:${user.username}`);
            return res.status(500).json({ message: 'An error occurred, please try again later.' });
        } if (!users || !users.length) {
            awesomeLog(req, `User not found in Mongo:${user.username}`);
            return res.status(404).json({ message: 'An error occurred. Please try refreshing your page.' });
        }
        return callback(users[0]);
    });
}

function getMongoUser(req, res, user) {
    return db.users.find({ username: user.username }, (err, users) => {
        if (err) {
            throw err;
        }

        if (!users || !users.length) {
            awesomeLog(req, `User not found in Mongo:${user.username}`);
            return null;
        }

        return users[0];
    });
}

module.exports = {
    authenticateModerator,
    authenticateUser,
    verifyPassword,
    generateSession,
    isModerator,
    loadMongoUser,
    getMongoUser,
};