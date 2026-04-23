export const PUBLICATION_TYPE_META = {
  idea: { label: 'Idea', icon: '💡' },
  post: { label: 'Post', icon: '✍️' },
  video: { label: 'Vídeo', icon: '🎬' },
  article: { label: 'Artículo', icon: '📝' },
};

export const PUBLICATION_TYPE_OPTIONS = [
  { value: 'idea', label: 'Idea' },
  { value: 'post', label: 'Post' },
  { value: 'video', label: 'Vídeo' },
  { value: 'article', label: 'Artículo' },
];

export function getPublicationTypeMeta(type) {
  return PUBLICATION_TYPE_META[type] || PUBLICATION_TYPE_META.idea;
}
