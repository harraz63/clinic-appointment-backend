import { DataTypes, Model } from 'sequelize';
import { env } from '../../../../config/env.js';
import { sequelize } from '../../../../database/db-config.js';
import { LocalizedText } from '../../../../shared/localized-text.js';

export class DoctorModel extends Model {
    declare id: string;
    declare userId: string;
    declare branchId: string;
    declare specialtyId: string;
    declare name: LocalizedText;
    declare biography: LocalizedText | null;
    declare appointmentPrice: string;
    declare currency: string;
    declare appointmentDurationMinutes: number;
    declare isAvailable: boolean;
    declare isActive: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

DoctorModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    branchId: { type: DataTypes.UUID, allowNull: false, references: { model: 'branches', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    specialtyId: { type: DataTypes.UUID, allowNull: false, references: { model: 'specialties', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    name: { type: DataTypes.JSONB, allowNull: false },
    biography: { type: DataTypes.JSONB, allowNull: true },
    appointmentPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: env.CLINIC_CURRENCY },
    appointmentDurationMinutes: { type: DataTypes.INTEGER, allowNull: false },
    isAvailable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    sequelize,
    modelName: 'Doctor',
    tableName: 'doctors',
    timestamps: true,
    indexes: [{'fields':['branchId']},{'fields':['specialtyId']}],
});
