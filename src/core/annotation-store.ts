import type { Annotation } from '@/types';

export type AnnotationStore = {
  getAnnotations: () => Annotation[];
  setAnnotations: (next: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (
    id: string,
    updater: (annotation: Annotation) => Annotation,
  ) => Annotation | null;
  removeAnnotation: (id: string) => { annotation: Annotation | null; index: number };
  clearAnnotations: () => Annotation[];
  getAnnotationById: (id: string) => Annotation | null;
  getAnnotationIndex: (id: string) => number;
};

export function createAnnotationStore(initial: Annotation[] = []): AnnotationStore {
  let annotations = initial.slice();
  const annotationById = new Map<string, Annotation>();
  const annotationIndexById = new Map<string, number>();

  function refreshIndex(): void {
    annotationById.clear();
    annotationIndexById.clear();
    annotations.forEach(function setAnnotation(annotation, index) {
      annotationById.set(annotation.id, annotation);
      annotationIndexById.set(annotation.id, index);
    });
  }

  function getAnnotations(): Annotation[] {
    return annotations;
  }

  function setAnnotations(next: Annotation[]): void {
    annotations = next.slice();
    refreshIndex();
  }

  function addAnnotation(annotation: Annotation): void {
    annotations = annotations.concat(annotation);
    refreshIndex();
  }

  function updateAnnotation(
    id: string,
    updater: (annotation: Annotation) => Annotation,
  ): Annotation | null {
    let updated: Annotation | null = null;
    annotations = annotations.map(function mapAnnotation(item) {
      if (item.id === id) {
        updated = updater(item);
        return updated;
      }
      return item;
    });
    refreshIndex();
    return updated;
  }

  function removeAnnotation(id: string): { annotation: Annotation | null; index: number } {
    const index = annotationIndexById.get(id);
    if (typeof index !== 'number') {
      return { annotation: null, index: -1 };
    }
    const annotation = annotations[index] || null;
    annotations = annotations.filter(function filterAnnotation(item) {
      return item.id !== id;
    });
    refreshIndex();
    return { annotation, index };
  }

  function clearAnnotations(): Annotation[] {
    const cleared = annotations.slice();
    annotations = [];
    refreshIndex();
    return cleared;
  }

  function getAnnotationById(id: string): Annotation | null {
    return annotationById.get(id) || null;
  }

  function getAnnotationIndex(id: string): number {
    const index = annotationIndexById.get(id);
    return typeof index === 'number' ? index : -1;
  }

  refreshIndex();

  return {
    getAnnotations,
    setAnnotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    clearAnnotations,
    getAnnotationById,
    getAnnotationIndex,
  };
}
