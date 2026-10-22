import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { Roles } from '../../constants/roles.js';

export const migrationName = '001-initial-schema';

export async function up(queryInterface: QueryInterface, sequelize: Sequelize) {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await queryInterface.createTable('users', {
        id: {
            type: DataTypes.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey: true,
            allowNull: false,
        },
        provider: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM(...Object.values(Roles)),
            allowNull: false,
            defaultValue: Roles.USER,
        },
        googleId: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true,
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        isBlocked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });

    await queryInterface.createTable('user_sessions', {
        id: {
            type: DataTypes.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey: true,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        },
        refreshToken: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        fcmToken: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });

    await queryInterface.createTable('media', {
        id: {
            type: DataTypes.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey: true,
            allowNull: false,
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        originalName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        contentType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mediaType: {
            type: DataTypes.ENUM('image', 'video', 'document'),
            allowNull: false,
        },
        size: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        thumbnails: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.dropTable('media');
    await queryInterface.dropTable('user_sessions');
    await queryInterface.dropTable('users');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_media_mediaType";');
}
