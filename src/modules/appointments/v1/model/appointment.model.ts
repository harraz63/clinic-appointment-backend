import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { AppointmentStatusValue } from '../../../../constants/appointment-status.js';

export class AppointmentModel extends Model {
    declare id: string;
    declare customerId: string;
    declare doctorId: string;
    declare branchId: string;
    declare startsAt: Date;
    declare endsAt: Date;
    declare timezone: string;
    declare durationMinutes: number;
    declare bookedPrice: string;
    declare currency: string;
    declare status: AppointmentStatusValue;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

AppointmentModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    customerId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    doctorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'doctors', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    branchId: { type: DataTypes.UUID, allowNull: false, references: { model: 'branches', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    startsAt: { type: DataTypes.DATE, allowNull: false },
    endsAt: { type: DataTypes.DATE, allowNull: false },
    timezone: { type: DataTypes.STRING(255), allowNull: false },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: false },
    bookedPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
}, {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
    timestamps: true,
    indexes: [{'fields':['doctorId','startsAt']},{'fields':['customerId','startsAt']},{'fields':['branchId','startsAt']},{'fields':['status']}],
});
