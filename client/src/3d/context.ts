import { createContext, useContext } from 'react';
import { detectQuality, type QualitySettings } from './quality';

export const QualityContext = createContext<QualitySettings | null>(null);

export function useQuality(): QualitySettings {
  return useContext(QualityContext) ?? detectQuality();
}
