/**
 * Frontend API Service
 * Handles all REST API calls to backend
 */

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';

class APIService {
  /**
   * GET /api/projects
   * Fetch all projects for current user
   */
  static async getProjects() {
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * POST /api/projects
   * Create new project
   */
  static async createProject(name, description = '') {
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * GET /api/projects/:id
   * Fetch project details
   */
  static async getProject(projectId) {
    const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * PUT /api/projects/:id
   * Update project
   */
  static async updateProject(projectId, name, description) {
    const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * DELETE /api/projects/:id
   * Delete project
   */
  static async deleteProject(projectId) {
    const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * POST /api/projects/:id/export
   * Export project
   */
  static async exportProject(projectId, format = 'json') {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/export`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ format }),
    });

    if (!response.ok) {
      throw new Error(`Failed to export project: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * GET /api/test
   * Test backend connection
   */
  static async testConnection() {
    try {
      const response = await fetch(`${API_URL}/api/test`, {
        method: 'GET',
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      return false;
    }
  }
}

export default APIService;
