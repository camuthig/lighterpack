const fs = require('fs');
const path = require('path');
const config = require('config');
const awesomeLog = require('./log.js');

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const moderatorList = config.get('moderators')


const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

// one day in many years this can go away.
eval(`${fs.readFileSync(path.join(__dirname, './sha3.js'))}`);

const authenticateModerator = function(req, res, callback) {
    authenticateUser(req, res, (req, res, user) => {
        if (!isModerator(user.username)) {
            return res.status(403).json({ message: 'Denied.' });
        }
        callback(req, res, user);
    });
}

const authenticateUser = async function(req, res, callback) {
    if (!req.cookies.lp && (!req.body.username || !req.body.password)) {
        return res.status(401).json({ message: 'Please log in.' });
    }
    if (req.body.username && req.body.password) {
        const username = String(req.body.username).toLowerCase().trim();
        const password = String(req.body.password);
        verifyPassword(username, password)
            .then((user) => {
                generateSession(req, res, user, callback);
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

        callback(req, res, users[0]);
    }
}

const verifyPassword = async function(username, password) {
    return new Promise((resolve, reject) => {
        let user = await prisma.user.findUnique({ where: { username } });

        if (!user) {
            return reject({ code: 404, message: 'Invalid username and/or password.' });
        }

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                return reject({ code: 500, message: 'An error occurred, please try again later.' });
            }
            if (!result) {
                const sha3password = CryptoJS.SHA3(password + username).toString(CryptoJS.enc.Base64);
                bcrypt.compare(sha3password, user.password, (err, result) => {
                    if (err) {
                        reject({ code: 500, message: 'An error occurred, please try again later.' });
                    }
                    if (!result) {
                        /* TODO: reinstate this block after DB migration */
                        /* reject({code: 404, message: "Invalid username and/or password."}); */

                        /* TODO: remove this block after DB migration */
                        if (sha3password === user.password) {
                            resolve(user);
                        } else {
                            /* TODO: revert this error message by removing refresh text */
                            reject({ code: 404, message: 'Invalid username and/or password. Please refresh the page before trying again.' });
                        }
                    } else {
                        // Remove extra layer of hashing. Just bcrypt.
                        bcrypt.genSalt(10, (err, salt) => {
                            if (err) {
                                return reject({ code: 500, message: 'An error occurred, please try again later.' });
                            }
                            bcrypt.hash(password, salt, (err, hash) => {
                                if (err) {
                                    return reject({ code: 500, message: 'An error occurred, please try again later.' });
                                }

                                prisma.user.update({
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

const generateSession= function(req, res, user, callback) {
    crypto.randomBytes(48, (ex, buf) => {
        const token = buf.toString('hex');

        prisma.user.update({
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

module.exports = {
    authenticateModerator,
    authenticateUser,
    verifyPassword,
    generateSession,
    isModerator,
};