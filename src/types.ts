export type OutputDetailLevel = 'compact' | 'standard' | 'detailed' | 'forensic';

export type Annotation = {
  id: string;
  x: number;
  y: number;
  comment: string;
  element: string;
  elementPath: string;
  timestamp: number;
  selectedText?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  nearbyText?: string;
  cssClasses?: string;
  nearbyElements?: string;
  computedStyles?: string;
  fullPath?: string;
  accessibility?: string;
  isMultiSelect?: boolean;
  isFixed?: boolean;
};

export type StorageAdapter = {
  load: (key: string) => Annotation[];
  save: (key: string, annotations: Annotation[]) => void;
  clear: (key: string) => void;
};

export type UiAnnotatorSettings = {
  outputDetail: OutputDetailLevel;
  autoClearAfterCopy: boolean;
  annotationColor: string;
  blockInteractions: boolean;
};

export type UiAnnotatorOptions = {
  mount?: HTMLElement | ShadowRoot | string;
  zIndex?: number;
  initialTheme?: 'dark' | 'light';
  settings?: Partial<UiAnnotatorSettings>;
  storageAdapter?: StorageAdapter;
  onCopy?: (markdown: string) => void | Promise<void>;
};

export type UiAnnotatorInstance = {
  destroy: () => void;
  setSettings: (next: Partial<UiAnnotatorSettings>) => void;
  getAnnotations: () => Annotation[];
  copyOutput: () => Promise<string>;
};
