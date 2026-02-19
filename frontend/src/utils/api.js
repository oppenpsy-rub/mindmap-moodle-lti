const API_URL = import.meta.env.VITE_API_URL || '';

class APIService {
  static async getProjects() {
    const res = await fetch(`${API_URL}/api/projects`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to fetch boards: ${res.statusText}`);
    return res.json();
  }

  static async createProject(name, boardType = 'mindmap', description = '') {
    const res = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, boardType, description }),
    });
    if (!res.ok) throw new Error(`Failed to create board: ${res.statusText}`);
    return res.json();
  }

  static async getProject(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to fetch board: ${res.statusText}`);
    return res.json();
  }

  static async updateProject(projectId, data) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update board: ${res.statusText}`);
    return res.json();
  }

  static async deleteProject(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to delete board: ${res.statusText}`);
    return res.json();
  }
}

export default APIService;
