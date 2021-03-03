const bcrypt = require('bcryptjs');
const express = require('express');

const router = express.Router();
const config = require('config');
const awesomeLog = require('./log.js');

const mongojs = require('mongojs');
const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const { authenticateModerator, getMongoUser } = require('./auth.js');

router.get('/moderation/search', (req, res) => {
    authenticateModerator(req, res, search);
});

async function search(req, res) {
    let searchQuery = String(req.query.q).toLowerCase().trim();
    users = await prisma.user.findMany({
        where: {
            OR: [
                {
                    username: {
                        startsWith: searchQuery,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: searchQuery,
                        mode: "insensitive",
                    },
                },
            ],
        },
        orderBy: {
            username: 'asc',
        }
    });



    await db.users.find({ username: { $in: users.map((user) => user.username) } }).sort({username: 1}, (err, mongoUsers) => {
        out = []
        pgIndex = 0;
        mongoIndex = 0;
        for (; pgIndex < users.length && mongoIndex < mongoUsers.length; pgIndex++) {
            pUser = users[pgIndex];
            for (; mongoIndex < mongoUsers.length; mongoIndex++) {
                mUser = mongoUsers[mongoIndex]
                if (pUser.username == mUser.username) {
                    out.push({
                        username: pUser.username,
                        email: pUser.email,
                        library: mUser.library,
                    })
                } else {
                    awesomeLog(req, `No mongo user found for Postgres user ${pUser.username}`);
                }
            }
        }

        res.json({results: out});
    });
}


router.post('/moderation/reset-password', (req, res) => {
    authenticateModerator(req, res, resetPassword);
});

async function resetPassword(req, res) {
    let username = String(req.body.username).toLowerCase().trim();
    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        awesomeLog(req, `MODERATION Reset password for unknown user:${username}`);
        return res.status(500).json({ message: 'An error occurred.' });
    }

    require('crypto').randomBytes(12, async (ex, buf) => {
        const newPassword = buf.toString('hex');

        bcrypt.genSalt(10, async (err, salt) => {
            bcrypt.hash(newPassword, salt, async (err, hash) => {

                await prisma.user.update({
                    where: { id: user.id },
                    data: { passwordHash: hash },
                })

                const out = { newPassword };
                awesomeLog(req, `MODERATION password changed for user:${username}`);
                return res.status(200).json(out);
            });
        });
    });
}


module.exports = router;
