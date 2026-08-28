import api from '@/lib/axios'

export const getArticles = (params?: Record<string, unknown>) =>
  api.get('/blog/admin/articles', { params }).then((r) => r.data)

export const getArticleById = (id: string) =>
  api.get(`/blog/admin/articles/${id}`).then((r) => r.data)

export const createArticle = (data: unknown) =>
  api.post('/blog/admin/articles', data).then((r) => r.data)

export const updateArticle = (id: string, data: unknown) =>
  api.patch(`/blog/admin/articles/${id}`, data).then((r) => r.data)

export const deleteArticle = (id: string) =>
  api.delete(`/blog/admin/articles/${id}`).then((r) => r.data)

export const refreshArticleCache = (articleId?: string) =>
  api.post(`/blog/admin/refresh/${articleId || 'all'}`).then((r) => r.data)

export const getCategories = () =>
  api.get('/blog/categories').then((r) => r.data)

export const createCategory = (data: { name: string; slug: string; description?: string; parentId?: string }) =>
  api.post('/blog/admin/categories', data).then((r) => r.data)

export const updateCategory = (id: string, data: { name?: string; slug?: string; description?: string; parentId?: string }) =>
  api.patch(`/blog/admin/categories/${id}`, data).then((r) => r.data)

export const deleteCategory = (id: string) =>
  api.delete(`/blog/admin/categories/${id}`).then((r) => r.data)

export const getTags = () =>
  api.get('/blog/tags').then((r) => r.data)

export const createTag = (data: { name: string; slug: string }) =>
  api.post('/blog/admin/tags', data).then((r) => r.data)

export const updateTag = (id: string, data: { name?: string; slug?: string }) =>
  api.patch(`/blog/admin/tags/${id}`, data).then((r) => r.data)

export const deleteTag = (id: string) =>
  api.delete(`/blog/admin/tags/${id}`).then((r) => r.data)

export const getRelatedArticles = (id: string, limit = 3) =>
  api.get(`/blog/articles/${id}/related`, { params: { limit } }).then((r) => r.data)

export const uploadBlogImage = (file: File, onProgress?: (percent: number) => void) => {
  const formData = new FormData();
  formData.append('image', file);
  return api.post('/blog/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  }).then((r) => r.data);
};
