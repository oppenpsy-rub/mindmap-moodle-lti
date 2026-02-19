import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireLTISession } from '../lti/routes.js';
import { Project, ProjectState, ProjectMember, AuditLog, User } from '../db/models.js';

const router = express.Router();

/**
 * Middleware: Ensure LTI session is authenticated
 */
router.use(requireLTISession);

/**
 * GET /api/projects
 * Get all projects for current user
 */
router.get('/projects', async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get projects where user is a member or creator
    const projects = await Project.findAll({
      include: [
        {
          model: ProjectMember,
          where: { userId },
          required: false,
        },
      ],
      where: {
        createdBy: userId,
      },
      order: [['updatedAt', 'DESC']],
      attributes: ['id', 'name', 'description', 'boardType', 'courseId', 'createdBy', 'createdAt', 'updatedAt'],
    });

    res.json(projects);
  } catch (error) {
    console.error('GET /projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * POST /api/projects
 * Create new project
 */
router.post('/projects', async (req, res) => {
  try {
    const { name, description, boardType } = req.body;
    const userId = req.session.userId;

    // Ensure user exists in database (required for foreign key)
    await User.findOrCreate({
      where: { id: userId },
      defaults: {
        moodleUserId: userId,
        name: req.session.name || 'User',
        email: req.session.email || null,
        role: req.session.role || 'student',
      },
    });

    const projectId = uuidv4();

    const project = await Project.create({
      id: projectId,
      name: name || 'New Board',
      description: description || '',
      boardType: boardType || 'mindmap',
      courseId: req.session.courseId || null,
      createdBy: userId,
    });

    // Add creator as owner
    await ProjectMember.create({
      projectId: projectId,
      userId: userId,
      role: 'owner',
    });

    // Log action
    await AuditLog.create({
      projectId,
      userId,
      action: 'created',
      details: { name },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('POST /projects error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/projects/:id
 * Get project details + latest Yjs state
 */
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    // Check access
    const member = await ProjectMember.findOne({
      where: { projectId: id, userId },
    });

    if (!member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get latest Yjs state
    const latestState = await ProjectState.findOne({
      where: { projectId: id },
      order: [['version', 'DESC']],
      limit: 1,
    });

    res.json({
      project,
      yjsState: latestState ? latestState.yjsState : null,
      stateVersion: latestState ? latestState.version : 0,
    });
  } catch (error) {
    console.error('GET /projects/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * PUT /api/projects/:id
 * Update project details
 */
router.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.session.userId;

    // Check access (owner only)
    const member = await ProjectMember.findOne({
      where: { projectId: id, userId, role: 'owner' },
    });

    if (!member) {
      return res.status(403).json({ error: 'Only owner can modify project' });
    }

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await project.update({
      name: name !== undefined ? name : project.name,
      description: description !== undefined ? description : project.description,
    });

    // Log action
    await AuditLog.create({
      projectId: id,
      userId,
      action: 'updated',
      details: { name, description },
    });

    res.json(project);
  } catch (error) {
    console.error('PUT /projects/:id error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    // Check access (owner only)
    const member = await ProjectMember.findOne({
      where: { projectId: id, userId, role: 'owner' },
    });

    if (!member) {
      return res.status(403).json({ error: 'Only owner can delete project' });
    }

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Log action before deletion
    await AuditLog.create({
      projectId: id,
      userId,
      action: 'deleted',
    });

    await project.destroy();

    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('DELETE /projects/:id error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * POST /api/projects/:id/export
 * Export project as PNG, PDF, or JSON
 */
router.post('/projects/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.body;
    const userId = req.session.userId;

    // Check access
    const member = await ProjectMember.findOne({
      where: { projectId: id, userId },
    });

    if (!member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const latestState = await ProjectState.findOne({
      where: { projectId: id },
      order: [['version', 'DESC']],
      limit: 1,
    });

    // Log action
    await AuditLog.create({
      projectId: id,
      userId,
      action: 'exported',
      details: { format },
    });

    // TODO: Implement actual export based on format
    // For now, return JSON snapshot

    res.json({
      projectId: id,
      projectName: project.name,
      format,
      yjsState: latestState ? latestState.yjsState?.toString('base64') : null,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('POST /export error:', error);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

/**
 * POST /api/projects/:id/share
 * Add member to project
 */
router.post('/projects/:id/share', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, role = 'viewer' } = req.body;
    const userId = req.session.userId;

    // Check access (owner only)
    const member = await ProjectMember.findOne({
      where: { projectId: id, userId, role: 'owner' },
    });

    if (!member) {
      return res.status(403).json({ error: 'Only owner can share project' });
    }

    // TODO: Find user by email and add to project
    // For now, return error
    res.status(501).json({ error: 'User lookup by email not yet implemented' });
  } catch (error) {
    console.error('POST /share error:', error);
    res.status(500).json({ error: 'Failed to share project' });
  }
});

export default router;
