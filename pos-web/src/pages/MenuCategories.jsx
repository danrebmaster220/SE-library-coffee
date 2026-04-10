import { useState, useEffect } from "react";
import api from "../api";
import FilterSelectWrap from "../components/FilterSelectWrap";
import "../styles/menu-management-styles/index.css";

/** Normalize DB flags so Temp column always matches (0/1, strings, null). */
const toFlag01 = (v, defaultOn = true) => {
  if (v === undefined || v === null || v === "") return defaultOn ? 1 : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  if (!Number.isNaN(n)) return n === 0 ? 0 : 1;
  return defaultOn ? 1 : 0;
};

const normalizeCategoryList = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    allow_hot: toFlag01(row.allow_hot, true),
    allow_iced: toFlag01(row.allow_iced, true)
  }));

const tempModesLabel = (allowHot, allowIced) => {
  if (!allowHot && !allowIced) return "Disabled";
  if (allowHot && allowIced) return "Hot / Iced";
  return allowHot ? "Hot" : "Iced";
};

export default function MenuCategories() {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", status: "active", allow_hot: true, allow_iced: true, addon_limit: "" });
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get("/menu/categories", {
        params: { _: Date.now() }
      });
      const raw = response.data.categories || response.data || [];
      setCategories(normalizeCategoryList(raw));
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await api.put(`/menu/categories/${editingCategory.category_id}`, formData);
        const hot = formData.allow_hot ? 1 : 0;
        const iced = formData.allow_iced ? 1 : 0;
        setCategories((prev) =>
          normalizeCategoryList(
            prev.map((c) =>
              c.category_id === editingCategory.category_id
                ? {
                    ...c,
                    name: formData.name.trim(),
                    status: formData.status,
                    allow_hot: hot,
                    allow_iced: iced,
                    addon_limit: formData.addon_limit !== "" ? parseInt(formData.addon_limit, 10) : null
                  }
                : c
            )
          )
        );
      } else {
        const response = await api.post("/menu/categories", formData);
        const newId = response.data?.category_id;
        const hot = formData.allow_hot ? 1 : 0;
        const iced = formData.allow_iced ? 1 : 0;
        if (newId != null) {
          setCategories((prev) =>
            normalizeCategoryList([
              ...prev,
              {
                category_id: newId,
                name: formData.name.trim(),
                status: formData.status,
                allow_hot: hot,
                allow_iced: iced,
                addon_limit: formData.addon_limit !== "" ? parseInt(formData.addon_limit, 10) : null,
                created_at: new Date().toISOString()
              }
            ])
          );
        }
      }
      await fetchCategories();
      closeModal();
    } catch (error) {
      console.error("Error saving category:", error);
      alert("Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (category) => {
    setDeleteTarget(category);
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
      await api.delete(`/menu/categories/${deleteTarget.category_id}`);
      fetchCategories();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Failed to delete category. It may have items linked to it.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      status: category.status || "active",
      allow_hot: toFlag01(category.allow_hot, true) === 1,
      allow_iced: toFlag01(category.allow_iced, true) === 1,
      addon_limit: category.addon_limit != null ? String(category.addon_limit) : ""
    });
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: "", status: "active", allow_hot: true, allow_iced: true });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: "", status: "active", allow_hot: true, allow_iced: true, addon_limit: "" });
  };

  const filteredCategories = categories.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(filterSearch.toLowerCase());
    const matchesStatus = !filterStatus || cat.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [filterSearch, filterStatus, categories]);

  const totalPages = Math.ceil(filteredCategories.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCategories = filteredCategories.slice(startIndex, endIndex);

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
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Manage your menu categories</p>
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
              placeholder="Search categories..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-filters-actions">
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
            Add Category
          </button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading-state">Loading categories...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="empty-state">
            <p>No categories found. Add your first category!</p>
          </div>
        ) : (
          <>
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category Name</th>
                    <th>Temp Modes</th>
                    <th>Add-on Limit</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                {paginatedCategories.map((category) => (
                  <tr key={category.category_id}>
                    <td>#{category.category_id}</td>
                    <td><span className="item-name-text">{category.name}</span></td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#5d4037', fontWeight: 600 }}>
                        {tempModesLabel(
                          toFlag01(category.allow_hot, true) === 1,
                          toFlag01(category.allow_iced, true) === 1
                        )}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: category.addon_limit != null ? '#e65100' : '#888', fontWeight: 600 }}>
                        {category.addon_limit != null ? category.addon_limit : 'Unlimited'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${category.status === "active" ? "status-active" : "status-inactive"}`}>
                        {category.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{category.created_at ? new Date(category.created_at).toLocaleDateString() : "-"}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-action btn-edit" onClick={() => openEditModal(category)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit
                        </button>
                        <button className="btn-action btn-delete" onClick={() => openDeleteModal(category)}>
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
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredCategories.length)} of {filteredCategories.length}
                </span>
                <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
                <button className="pagination-btn" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
                {getPageNumbers(currentPage, totalPages).map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                  ) : (
                    <button key={page} className={currentPage === page ? "pagination-btn active" : "pagination-btn"} onClick={() => setCurrentPage(page)}>{page}</button>
                  )
                ))}
                <button className="pagination-btn" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
                <button className="pagination-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Category Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#333' }}>{editingCategory ? "Edit Category" : "Add New Category"}</h3>
              <button className="modal-close" onClick={closeModal} style={{ color: '#666' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter category name"
                  required
                />
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
              <div className="form-group checkbox-group" style={{ marginTop: '10px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!formData.allow_hot}
                    onChange={(e) => setFormData({ ...formData, allow_hot: e.target.checked })}
                  />
                  <span>Allow Hot in this category</span>
                </label>
              </div>
              <div className="form-group checkbox-group" style={{ marginTop: '4px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!formData.allow_iced}
                    onChange={(e) => setFormData({ ...formData, allow_iced: e.target.checked })}
                  />
                  <span>Allow Iced in this category</span>
                </label>
              </div>
              <small className="form-hint" style={{ display: 'block', marginTop: '6px' }}>
                These toggles control which Temperature options appear for items in this category.
              </small>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Add-on Limit</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.addon_limit}
                  onChange={(e) => setFormData({ ...formData, addon_limit: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  min="1"
                  max="99"
                />
                <small className="form-hint" style={{ display: 'block', marginTop: '4px' }}>
                  Maximum total add-on quantity across all groups (e.g., 3 for drinks). Leave empty for no limit.
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-confirm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : (editingCategory ? "Save Changes" : "Add Category")}
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
              <h3 className="modal-title" style={{ color: '#333' }}>Delete Category</h3>
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
                Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>?
              </p>
              <p className="delete-warning">All items in this category will be affected. This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={confirmDelete} disabled={isSubmitting}>
                {isSubmitting ? "Deleting..." : "Delete Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
