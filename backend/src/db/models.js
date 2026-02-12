import { DataTypes } from 'sequelize';
import { sequelize } from './connection.js';

/**
 * User Model (minimal, mainly for audit trails)
 */
export const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
  },
  moodleUserId: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('student', 'teacher', 'admin'),
    defaultValue: 'student',
  },
}, {
  timestamps: true,
  tableName: 'users',
});

/**
 * Project Model
 */
export const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'New Project',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  courseId: {
    type: DataTypes.STRING(255),
    allowNull: true, // Optional: tie to specific Moodle course
  },
  createdBy: {
    type: DataTypes.STRING(36),
    allowNull: false,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
  tableName: 'projects',
});

/**
 * ProjectState Model
 * Stores Yjs snapshots at intervals
 */
export const ProjectState = sequelize.define('ProjectState', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.STRING(36),
    allowNull: false,
  },
  yjsState: {
    type: DataTypes.BLOB('long'),
    allowNull: true,
    comment: 'Binary Yjs state snapshot',
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  checksum: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'SHA256 of state for deduplication',
  },
}, {
  timestamps: true,
  tableName: 'project_states',
  indexes: [
    {
      fields: ['projectId', 'version'],
    },
  ],
});

/**
 * ProjectMember Model
 * Track who has access to which project
 */
export const ProjectMember = sequelize.define('ProjectMember', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.STRING(36),
    allowNull: false,
  },
  userId: {
    type: DataTypes.STRING(36),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('owner', 'editor', 'viewer'),
    defaultValue: 'viewer',
  },
}, {
  timestamps: true,
  tableName: 'project_members',
  indexes: [
    {
      fields: ['projectId', 'userId'],
      unique: true,
    },
  ],
});

/**
 * AuditLog Model
 * Track all actions for security/debugging
 */
export const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  projectId: {
    type: DataTypes.STRING(36),
    allowNull: true,
  },
  userId: {
    type: DataTypes.STRING(36),
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'create, edit, delete, share, export, etc',
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'audit_log',
  indexes: [
    {
      fields: ['projectId'],
    },
    {
      fields: ['userId'],
    },
  ],
});

/**
 * Define Relationships
 */
Project.hasMany(ProjectState, { foreignKey: 'projectId', onDelete: 'CASCADE' });
ProjectState.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(ProjectMember, { foreignKey: 'projectId', onDelete: 'CASCADE' });
ProjectMember.belongsTo(Project, { foreignKey: 'projectId' });

ProjectMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(ProjectMember, { foreignKey: 'userId' });

Project.hasMany(AuditLog, { foreignKey: 'projectId', onDelete: 'CASCADE' });
AuditLog.belongsTo(Project, { foreignKey: 'projectId' });

export default {
  User,
  Project,
  ProjectState,
  ProjectMember,
  AuditLog,
};
