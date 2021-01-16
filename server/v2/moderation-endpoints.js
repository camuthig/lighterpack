const bcrypt = require('bcryptjs');
const express = require('express');

const router = express.Router();
const mongojs = require('mongojs');
const config = require('config');
const awesomeLog = require('../log.js');

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const { authenticateModerator } = require('./auth.js');

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
    });


    let out = users.map((user) => {
        return {
            username: user.username,
            email: user.email,
            library: {} // WIP Implement library retrieval
        };
    });

    res.json({results: out});
}


router.post('/moderation/reset-password', (req, res) => {
    authenticateModerator(req, res, resetPassword);
});

async function resetPassword(req, res) {
    let username = String(req.body.username).toLowerCase().trim();
    console.log(username);

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        awesomeLog(req, `MODERATION Reset password for unknown user:${username}`);
        return res.status(500).json({ message: 'An error occurred.' });
    }

    require('crypto').randomBytes(12, (ex, buf) => {
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
