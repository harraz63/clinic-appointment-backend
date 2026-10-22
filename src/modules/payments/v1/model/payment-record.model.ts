import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { PaymentStatusValue } from '../../../../constants/payment-status.js';

export class PaymentRecordModel extends Model {
    declare id: string;
    declare appointmentId: string;
    declare paymentMethodId: string;
    declare amount: string;
    declare currency: string;
    declare status: PaymentStatusValue;
    declare receivedAt: Date | null;
    declare receivedBy: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

PaymentRecordModel.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    appointmentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'appointments', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    paymentMethodId: { type: DataTypes.UUID, allowNull: false, references: { model: 'payment_methods', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'unpaid' },
    receivedAt: { type: DataTypes.DATE, allowNull: true },
    receivedBy: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
}, {
    sequelize,
    modelName: 'PaymentRecord',
    tableName: 'payment_records',
    timestamps: true,
    indexes: [{'fields':['appointmentId']},{'fields':['status']}],
});
