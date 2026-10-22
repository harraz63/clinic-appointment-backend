import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { LocalizedText } from '../../../../shared/localized-text.js';

export class ScheduleExceptionModel extends Model {
    declare id: string;
    declare doctorId: string;
    declare date: string;
    declare isDayOff: boolean;
    declare startTime: string | null;
    declare endTime: string | null;
    declare reason: LocalizedText | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

ScheduleExceptionModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    doctorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'doctors', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    isDayOff: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    startTime: { type: DataTypes.TIME, allowNull: true },
    endTime: { type: DataTypes.TIME, allowNull: true },
    reason: { type: DataTypes.JSONB, allowNull: true },
}, {
    sequelize,
    modelName: 'ScheduleException',
    tableName: 'schedule_exceptions',
    timestamps: true,
    indexes: [{'fields':['doctorId','date']}],
});
