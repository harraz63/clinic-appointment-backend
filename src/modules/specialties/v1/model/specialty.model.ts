import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { LocalizedText } from '../../../../shared/localized-text.js';

export class SpecialtyModel extends Model {
    declare id: string;
    declare name: LocalizedText;
    declare description: LocalizedText | null;
    declare isActive: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

SpecialtyModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    name: { type: DataTypes.JSONB, allowNull: false },
    description: { type: DataTypes.JSONB, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    sequelize,
    modelName: 'Specialty',
    tableName: 'specialties',
    timestamps: true,
    indexes: [],
});
