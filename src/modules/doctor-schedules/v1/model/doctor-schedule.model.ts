import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';

export class DoctorScheduleModel extends Model {
    declare id: string;
    declare doctorId: string;
    declare weekday: number;
    declare startTime: string;
    declare endTime: string;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

DoctorScheduleModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    doctorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'doctors', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    weekday: { type: DataTypes.INTEGER, allowNull: false },
    startTime: { type: DataTypes.TIME, allowNull: false },
    endTime: { type: DataTypes.TIME, allowNull: false },
}, {
    sequelize,
    modelName: 'DoctorSchedule',
    tableName: 'doctor_schedules',
    timestamps: true,
    indexes: [{'fields':['doctorId','weekday']}],
});
