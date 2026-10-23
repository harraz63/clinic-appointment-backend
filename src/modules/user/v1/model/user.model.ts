import { DataTypes, Model, Optional, Transaction } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { Roles, Role } from '../../../../constants/roles.js';
import { comparePasswords, hashPassword } from '../../../../utils/password.utils.js';
import { generateAuthToken, generateRefreshToken } from '../../../../utils/token.utils.js';
import { UserSessionModel } from '../../../user-session/v1/model/user-session.entity.js';


// ---------- Model ----------
export class UserModel extends Model {
    declare id: string;
    declare phone: string;
    declare password?: string;
    declare name: string;
    declare role: Role;
    declare googleId?: string;
    declare isVerified: boolean;
    declare isBlocked: boolean;

    // timestamps
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    // Password-inclusive scopes must never affect HTTP serialization.
    public toJSON() {
        const values = { ...this.get() };
        delete values.password;
        return values;
    }

    // ---------- Instance methods ----------
    public generateAuthToken(sessionId: string) {
        return generateAuthToken.call(this, sessionId);
    }

    public async generateRefreshToken(sessionId: string, transaction?: Transaction): Promise<string> {
        return generateRefreshToken.call(this, sessionId, transaction);
    }

    public async validatePassword(password: string): Promise<boolean> {
        if (!this.password) return false;
        return comparePasswords(password, this.password);
    }
}

// ---------- Init Model ----------
UserModel.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                is: /^\+201[0125]\d{8}$/,
            },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: true, // required only if no googleId
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                len: [5, 255],
            },
        },
        role: {
            type: DataTypes.ENUM(...Object.values(Roles)),
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
        },
        isBlocked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        defaultScope: {
            attributes: { exclude: ['password'] }, // hide password by default
        },
        scopes: {
            withPassword: {
                attributes: { include: ['password'] },
            },
        },
    }
);

// ---------- Hooks ----------
UserModel.beforeSave(async (user: UserModel) => {
    if (user.changed('password') && user.password) {
        user.password = await hashPassword(user.password);
    }
});
