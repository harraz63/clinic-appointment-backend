import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserModel } from '../../../user/v1/model/user.model.js';


// ---------- Model ----------
export class UserSessionModel extends Model {
    declare id: string;
    declare userId: string;
    declare refreshToken?: string;
    declare expiresAt?: Date;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

// ---------- Init ----------
UserSessionModel.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users', // Use model name string to avoid circular dependency
                key: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        },
        refreshToken: {
            type: DataTypes.TEXT,
            allowNull: true,
            unique: true, // uncomment if needed
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'UserSession',
        tableName: 'user_sessions',
        timestamps: true,
    }
);