import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { LocalizedText } from '../../../../shared/localized-text.js';

export class NotificationModel extends Model {
    declare id: string;
    declare recipientId: string;
    declare type: string;
    declare title: LocalizedText;
    declare body: LocalizedText;
    declare readAt: Date | null;
    declare relatedResourceType: string | null;
    declare relatedResourceId: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

NotificationModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    recipientId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    type: { type: DataTypes.STRING(255), allowNull: false },
    title: { type: DataTypes.JSONB, allowNull: false },
    body: { type: DataTypes.JSONB, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
    relatedResourceType: { type: DataTypes.STRING(255), allowNull: true },
    relatedResourceId: { type: DataTypes.UUID, allowNull: true },
}, {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    indexes: [{'fields':['recipientId','readAt','createdAt']}],
});
