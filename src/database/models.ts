/**
 * SAMI Weekly Reports - Database Models
 * Sequelize моделі для SQLite
 */

import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import path from 'path';
import fs from 'fs';
import config from '../config';

// Створення директорії для БД якщо не існує
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Ініціалізація Sequelize
export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.database.path,
    logging: config.logging.level === 'debug' ? console.log : false,
    define: {
        timestamps: true,
        underscored: true,
    },
});

// ============================================
// USER MODEL
// ============================================

interface UserAttributes {
    userId: number;
    telegramId: number;
    name: string;
    position: string;
    team: string;
    isManager: boolean;
    managerId: number | null;
    language: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'userId' | 'position' | 'team' | 'isManager' | 'managerId' | 'language'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    declare userId: number;
    declare telegramId: number;
    declare name: string;
    declare position: string;
    declare team: string;
    declare isManager: boolean;
    declare managerId: number | null;
    declare language: string;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

User.init(
    {
        userId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            field: 'user_id',
        },
        telegramId: {
            type: DataTypes.BIGINT,
            unique: true,
            allowNull: false,
            field: 'telegram_id',
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        position: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'Other',
        },
        team: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'Other',
        },
        isManager: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_manager',
        },
        managerId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'manager_id',
            references: {
                model: 'users',
                key: 'user_id',
            },
        },
        language: {
            type: DataTypes.STRING(5),
            defaultValue: 'uk',
        },
    },
    {
        sequelize,
        tableName: 'users',
        modelName: 'User',
    }
);

// ============================================
// REPORT MODEL
// ============================================

interface ReportAttributes {
    reportId: number;
    userId: number;
    weekNumber: number;
    year: number;
    workload: number;
    tasksCompleted: number;
    tasksNotCompleted: number;
    completionRate: number;
    hasBlockers: boolean;
    concerns: string | null;
    improvements: string | null;
    priorities: string | null;
    trelloCardId: string | null;
    trelloCardUrl: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ReportCreationAttributes extends Optional<ReportAttributes, 'reportId' | 'concerns' | 'improvements' | 'priorities' | 'trelloCardId' | 'trelloCardUrl'> {}

export class Report extends Model<ReportAttributes, ReportCreationAttributes> implements ReportAttributes {
    declare reportId: number;
    declare userId: number;
    declare weekNumber: number;
    declare year: number;
    declare workload: number;
    declare tasksCompleted: number;
    declare tasksNotCompleted: number;
    declare completionRate: number;
    declare hasBlockers: boolean;
    declare concerns: string | null;
    declare improvements: string | null;
    declare priorities: string | null;
    declare trelloCardId: string | null;
    declare trelloCardUrl: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

Report.init(
    {
        reportId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            field: 'report_id',
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'user_id',
            references: {
                model: 'users',
                key: 'user_id',
            },
        },
        weekNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'week_number',
        },
        year: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        workload: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5,
            },
        },
        tasksCompleted: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'tasks_completed',
        },
        tasksNotCompleted: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'tasks_not_completed',
        },
        completionRate: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'completion_rate',
        },
        hasBlockers: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'has_blockers',
        },
        concerns: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        improvements: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        priorities: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        trelloCardId: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'trello_card_id',
        },
        trelloCardUrl: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'trello_card_url',
        },
    },
    {
        sequelize,
        tableName: 'reports',
        modelName: 'Report',
        indexes: [
            {
                fields: ['user_id', 'week_number', 'year'],
                name: 'idx_reports_user_week_year',
            },
        ],
    }
);

// ============================================
// COMPLETED TASK MODEL
// ============================================

interface CompletedTaskAttributes {
    taskId: number;
    reportId: number;
    title: string;
    project?: string;
    hours: number;
}

interface CompletedTaskCreationAttributes extends Optional<CompletedTaskAttributes, 'taskId' | 'project'> {}

export class CompletedTask extends Model<CompletedTaskAttributes, CompletedTaskCreationAttributes> implements CompletedTaskAttributes {
    declare taskId: number;
    declare reportId: number;
    declare title: string;
    declare project: string;
    declare hours: number;
}

CompletedTask.init(
    {
        taskId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            field: 'task_id',
        },
        reportId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'report_id',
            references: {
                model: 'reports',
                key: 'report_id',
            },
        },
        title: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        project: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: '',
        },
        hours: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0,
        },
    },
    {
        sequelize,
        tableName: 'tasks_completed',
        modelName: 'CompletedTask',
        timestamps: false,
    }
);

// ============================================
// NOT COMPLETED TASK MODEL
// ============================================

interface NotCompletedTaskAttributes {
    taskId: number;
    reportId: number;
    title: string;
    reason: string;
    eta: Date | null;
    blocker: string | null;
}

interface NotCompletedTaskCreationAttributes extends Optional<NotCompletedTaskAttributes, 'taskId' | 'eta' | 'blocker'> {}

export class NotCompletedTask extends Model<NotCompletedTaskAttributes, NotCompletedTaskCreationAttributes> implements NotCompletedTaskAttributes {
    declare taskId: number;
    declare reportId: number;
    declare title: string;
    declare reason: string;
    declare eta: Date | null;
    declare blocker: string | null;
}

NotCompletedTask.init(
    {
        taskId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            field: 'task_id',
        },
        reportId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'report_id',
            references: {
                model: 'reports',
                key: 'report_id',
            },
        },
        title: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        eta: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        blocker: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'tasks_not_completed',
        modelName: 'NotCompletedTask',
        timestamps: false,
    }
);

// ============================================
// SETTINGS MODEL
// ============================================

interface SettingAttributes {
    key: string;
    value: string;
}

export class Setting extends Model<SettingAttributes> implements SettingAttributes {
    declare key: string;
    declare value: string;
}

Setting.init(
    {
        key: {
            type: DataTypes.STRING(100),
            primaryKey: true,
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'settings',
        modelName: 'Setting',
        timestamps: false,
    }
);

// ============================================
// ASSOCIATIONS
// ============================================

// User associations
User.hasMany(Report, { foreignKey: 'userId', as: 'reports' });
User.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });
User.hasMany(User, { foreignKey: 'managerId', as: 'subordinates' });

// Report associations
Report.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Report.hasMany(CompletedTask, { foreignKey: 'reportId', as: 'completedTasks' });
Report.hasMany(NotCompletedTask, { foreignKey: 'reportId', as: 'notCompletedTasks' });

// Task associations
CompletedTask.belongsTo(Report, { foreignKey: 'reportId', as: 'report' });
NotCompletedTask.belongsTo(Report, { foreignKey: 'reportId', as: 'report' });

// Export all models
export const models = {
    User,
    Report,
    CompletedTask,
    NotCompletedTask,
    Setting,
};

export default sequelize;
