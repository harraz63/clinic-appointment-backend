import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { LocalizedText } from '../../../../shared/localized-text.js';

export class BranchModel extends Model {
    declare id: string;
    declare name: LocalizedText;
    declare description: LocalizedText | null;
    declare address: LocalizedText;
    declare phone: string | null;
    declare email: string | null;
    declare timezone: string;
    declare isActive: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

BranchModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    name: { type: DataTypes.JSONB, allowNull: false },
    description: { type: DataTypes.JSONB, allowNull: true },
    address: { type: DataTypes.JSONB, allowNull: false },
    phone: { type: DataTypes.STRING(255), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    timezone: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Africa/Cairo' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    sequelize,
    modelName: 'Branch',
    tableName: 'branches',
    timestamps: true,
    indexes: [],
});
