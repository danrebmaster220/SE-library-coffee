import { useState, useEffect, useRef } from "react";
import api from "../api";
import FilterSelectWrap from "../components/FilterSelectWrap";
import "../styles/menu-management-styles/index.css";
import "../styles/menu.css";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [userPage, setUserPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    profile_image: null,
    username: "",
    password: "",
    role_id: "",
    status: "active"
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (roles.length > 0) {
      fetchUsers();
    }
  }, [roles]);

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      const usersData = response.data.users || response.data || [];
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get("/users/meta/roles");
      const rolesData = response.data.roles || response.data || [];
      setRoles(rolesData);
    } catch (error) {
      console.error("Error fetching roles:", error);
      // Default roles if API fails
      setRoles([
        { role_id: 1, role_name: "Admin" },
        { role_id: 2, role_name: "Cashier" },
        { role_id: 3, role_name: "Barista" }
      ]);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, profile_image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      alert("First name and last name are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || "",
        last_name: formData.last_name.trim(),
        profile_image: formData.profile_image,
        username: formData.username,
        role_id: parseInt(formData.role_id),
        status: formData.status
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await api.put(`/users/${editingUser.user_id}`, payload);
      } else {
        if (!formData.password) {
          alert("Password is required for new users");
          setIsSubmitting(false);
          return;
        }
        await api.post("/users", payload);
      }
      await fetchUsers();
      closeModal();
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Failed to save user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (user) => {
    setDeleteTarget(user);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/users/${deleteTarget.user_id}`);
      await fetchUsers();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name || "",
      middle_name: user.middle_name || "",
      last_name: user.last_name || "",
      profile_image: user.profile_image || null,
      username: user.username,
      password: "",
      role_id: user.role_id?.toString() || "",
      status: user.status || "active"
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      profile_image: null,
      username: "",
      password: "",
      role_id: "",
      status: "active"
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      profile_image: null,
      username: "",
      password: "",
      role_id: "",
      status: "active"
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getRoleName = (user) => {
    // First try role_name from API response (from JOIN)
    if (user.role_name) return user.role_name;
    // Fallback to lookup from roles array
    const role = roles.find((r) => r.role_id === user.role_id);
    return role ? role.role_name : "Unknown";
  };

  const getRoleBadgeClass = (roleName) => {
    const name = roleName?.toLowerCase() || "";
    if (name.includes("admin")) return "role-admin";
    if (name.includes("cashier")) return "role-cashier";
    if (name.includes("barista")) return "role-barista";
    return "role-barista";
  };

  // Filter users based on search, role, and status
  const filteredUsers = users
    .filter((user) => {
      const searchLower = filterSearch.toLowerCase();
      const display = user.display_name || user.full_name || "";
      const matchesSearch =
        display.toLowerCase().includes(searchLower) ||
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower);
      const matchesRole = !filterRole || user.role_id?.toString() === filterRole;
      const matchesStatus = !filterStatus || user.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });

  useEffect(() => {
    setUserPage(1);
  }, [filterSearch, filterRole, filterStatus, users]);

  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const startIndex = (userPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const getPageNumbers = (page, pages) => {
    const result = [];
    const maxVisiblePages = 5;

    if (pages <= maxVisiblePages) {
      for (let i = 1; i <= pages; i++) result.push(i);
    } else if (page <= 3) {
      result.push(1, 2, 3, 4, '...', pages);
    } else if (page >= pages - 2) {
      result.push(1, '...', pages - 3, pages - 2, pages - 1, pages);
    } else {
      result.push(1, '...', page - 1, page, page + 1, '...', pages);
    }

    return result;
  };

  return (
    <div className="main-content">
      <div className="page-header-section">
        <div className="page-title-group">
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Manage admin, cashier, and barista accounts</p>
        </div>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-left">
          <div className="search-box">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search by name or username..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-filters-actions">
            <FilterSelectWrap>
              <select
                className="filter-select"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="">All Roles</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </FilterSelectWrap>
            <FilterSelectWrap>
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FilterSelectWrap>
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn-primary-action" onClick={openAddModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add User
          </button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading-state">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p>No users found. Add your first user!</p>
          </div>
        ) : (
          <>
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr key={user.user_id}>
                      <td>#{user.user_id}</td>
                      <td>
                        <div className="item-image-cell">
                          {user.profile_image ? (
                            <img src={user.profile_image} alt="" className="table-image" />
                          ) : (
                            <div className="no-image-placeholder">—</div>
                          )}
                        </div>
                      </td>
                    <td>
                      <span className="item-name-text">{user.display_name || user.full_name}</span>
                    </td>
                    <td>
                      <span className="username-text">@{user.username}</span>
                    </td>
                    <td>
                      <span className={`role-badge ${getRoleBadgeClass(getRoleName(user))}`}>
                        {getRoleName(user)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.status === "active" ? "status-active" : "status-inactive"}`}>
                        {user.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-action btn-edit" onClick={() => openEditModal(user)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit
                        </button>
                        <button className="btn-action btn-delete" onClick={() => openDeleteModal(user)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination-container">
                <span className="pagination-info">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length}
                </span>
                <button className="pagination-btn" onClick={() => setUserPage(1)} disabled={userPage === 1}>«</button>
                <button className="pagination-btn" onClick={() => setUserPage(userPage - 1)} disabled={userPage === 1}>‹</button>
                {getPageNumbers(userPage, totalPages).map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                  ) : (
                    <button key={page} className={userPage === page ? "pagination-btn active" : "pagination-btn"} onClick={() => setUserPage(page)}>{page}</button>
                  )
                ))}
                <button className="pagination-btn" onClick={() => setUserPage(userPage + 1)} disabled={userPage === totalPages}>›</button>
                <button className="pagination-btn" onClick={() => setUserPage(totalPages)} disabled={userPage === totalPages}>»</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>{editingUser ? "Edit User" : "Add New User"}</h3>
              <button className="modal-close" onClick={closeModal} style={{ color: '#666' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Middle name (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                    placeholder="Middle name"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Last name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Last name"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Profile photo (optional)</label>
                <div className="image-upload-box">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input-hidden"
                    id="staff-profile-image"
                  />
                  {formData.profile_image ? (
                    <div className="image-preview-box">
                      <img src={formData.profile_image} alt="" />
                      <button
                        type="button"
                        className="change-image-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        className="remove-image-btn"
                        onClick={() => {
                          setFormData((p) => ({ ...p, profile_image: null }));
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="staff-profile-image" className="upload-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span>Choose Image</span>
                    </label>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g., juandc"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Password {editingUser && <span style={{ fontWeight: "normal", color: "#8d6e63" }}>(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "Enter new password (optional)" : "Enter password"}
                  required={!editingUser}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <FilterSelectWrap fullWidth>
                  <select
                    className="form-select"
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    required
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </FilterSelectWrap>
                {roles.find(r => r.role_id?.toString() === formData.role_id)?.role_name?.toLowerCase().includes('admin') && (
                  <p style={{ 
                    margin: '8px 0 0', 
                    padding: '8px 12px', 
                    backgroundColor: '#fff3e0', 
                    border: '1px solid #ffe0b2', 
                    borderRadius: '6px', 
                    fontSize: '12px', 
                    color: '#e65100',
                    lineHeight: '1.4'
                  }}>
                    ⚠️ Admin accounts have full system access. Create only as needed (e.g., backup account for password recovery).
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <FilterSelectWrap fullWidth>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </FilterSelectWrap>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-confirm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : (editingUser ? "Save Changes" : "Add User")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>Delete User</h3>
              <button className="modal-close" onClick={closeDeleteModal} style={{ color: '#666' }}>×</button>
            </div>
            <div className="delete-modal-body">
              <div className="delete-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <p className="delete-message">
                Are you sure you want to delete user <strong>"{deleteTarget.display_name || deleteTarget.full_name}"</strong>?
              </p>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={confirmDelete} disabled={isSubmitting}>
                {isSubmitting ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
