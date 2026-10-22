import { QueryInterface, Sequelize } from 'sequelize';

export interface Migration {
    name: string;
    up: (queryInterface: QueryInterface, sequelize: Sequelize) => Promise<void>;
    down: (queryInterface: QueryInterface, sequelize: Sequelize) => Promise<void>;
}
