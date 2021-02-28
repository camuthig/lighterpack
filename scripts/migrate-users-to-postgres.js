const config = require('config');
const mongojs = require('mongojs');

const collections = ['users', 'libraries'];

const db = mongojs(config.get('databaseUrl'), collections);

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
};

console.log('Loading users from Mongo....');
db.users.find({}, async (err, users) => {
    let migrated = 0;
    let errors = [];
    console.log('Adding missing users to PostgreSQL...');
    await asyncForEach(users, async (mongoUser) => {
        let existingCount = await prisma.user.count({
            where: {
                username: mongoUser.username,
            },
        });

        if (existingCount) {
            return;
        }

        try {
            await prisma.user.create({
                data: {
                    username: mongoUser.username,
                    passwordHash: mongoUser.password,
                    email: mongoUser.email,
                    token: mongoUser.token,
                    syncToken: mongoUser.syncToken,
                },
            });
        } catch (e) {
            errors.push({ 'username': mongoUser.username, 'error': e });
        }

        migrated++;
    })

    console.log('Done');
    console.log(`Migrated ${migrated} users to PostgreSQL`);

    console.log(`There were ${errors.length} errors`);
    errors.forEach(({username, e}) => {
        console.log(`Error on ${username}: ${e}`)
    });
});