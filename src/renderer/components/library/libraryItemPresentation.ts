import type { LocalArtifactItem } from '../../../shared/library/types';
import { i18nService } from '../../services/i18n';

export const formatLibraryTime = (value: number): string => new Intl.DateTimeFormat(
  i18nService.getLanguage() === 'zh' ? 'zh-CN' : 'en-US',
  { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
).format(new Date(value));

export const formatLibrarySize = (value?: number): string => {
  if (value === undefined) return i18nService.t('libraryUnknownSize');
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const getLibrarySourceLabel = (): string => (
  i18nService.t('libraryLocalArtifact')
);

export const getLibraryItemStatus = (item: LocalArtifactItem): string => (
  i18nService.t(`libraryAvailability_${item.availability}`)
);

export const getLibraryDisplayFileName = (item: LocalArtifactItem): string => item.title;
