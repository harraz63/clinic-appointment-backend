import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { Role } from '../../../../constants/roles.js';
import { AppointmentStatusValue } from '../../../../constants/appointment-status.js';
import { AppointmentAction } from '../appointment.permissions.js';

export interface AppointmentSnapshot {
    status: AppointmentStatusValue;
    startsAt: string;
    endsAt: string;
    branchId: string;
    timezone: string;
    durationMinutes: number;
    bookedPrice: string;
    currency: string;
}

export type HistoryAction = 'booked' | Exclude<AppointmentAction, 'view'>;

export class AppointmentHistoryModel extends Model {
    declare id: string;
    declare appointmentId: string;
    declare actorId: string | null;
    declare actorRole: Role;
    declare action: HistoryAction;
    declare occurredAt: Date;
    declare before: AppointmentSnapshot | null;
    declare after: AppointmentSnapshot;
}

AppointmentHistoryModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    appointmentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'appointments', key: 'id' }, onDelete: 'RESTRICT' },
    actorId: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    actorRole: { type: DataTypes.STRING, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    before: { type: DataTypes.JSONB, allowNull: true },
    after: { type: DataTypes.JSONB, allowNull: false },
}, { sequelize, modelName: 'AppointmentHistory', tableName: 'appointment_history', timestamps: false });
