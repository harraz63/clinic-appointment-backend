import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { LocalizedText } from '../../../../shared/localized-text.js';

export class PaymentMethodModel extends Model {
    declare id: string;
    declare code: string;
    declare name: LocalizedText;
    declare instructions: LocalizedText | null;
    declare isActive: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

PaymentMethodModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.JSONB, allowNull: false },
    instructions: { type: DataTypes.JSONB, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    sequelize,
    modelName: 'PaymentMethod',
    tableName: 'payment_methods',
    timestamps: true,
    indexes: [],
});
