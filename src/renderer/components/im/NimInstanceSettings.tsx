/**
 * NIM Instance Settings Component
 * Configuration form for a single NIM bot instance in multi-instance mode
 */

import { EyeIcon, EyeSlashIcon, XCircleIcon as XCircleIconSolid } from '@heroicons/react/20/solid';
import { SignalIcon } from '@heroicons/react/24/outline';
import { PlatformRegistry } from '@shared/platform';
import React, { useState } from 'react';

import { i18nService } from '../../services/i18n';
import type { IMConnectivityTestResult, NimInstanceConfig, NimInstanceStatus, NimOpenClawConfig } from '../../types/im';
import TrashIcon from '../icons/TrashIcon';
import type { UiHint } from './SchemaForm';
import { SchemaForm } from './SchemaForm';

interface NimInstanceSettingsProps {
  instance: NimInstanceConfig;
  instanceStatus: NimInstanceStatus | undefined;
  schemaData: { schema: Record<string, unknown>; hints: Record<string, UiHint> } | null;
  onConfigChange: (update: Partial<NimOpenClawConfig>) => void;
  onSave: (override?: Partial<NimOpenClawConfig>) => Promise<void>;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onTestConnectivity: () => void;
  testingPlatform: string | null;
  connectivityResults: Record<string, IMConnectivityTestResult>;
  language: 'zh' | 'en';
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown> || {}) };
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

const NimInstanceSettings: React.FC<NimInstanceSettingsProps> = ({
  instance,
  instanceStatus,
  schemaData,
  onConfigChange,
  onSave,
  onRename,
  onDelete,
  onToggleEnabled,
  onTestConnectivity,
  testingPlatform,
  connectivityResults,
  language,
}) => {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(instance.instanceName);

  React.useEffect(() => {
    setNameValue(instance.instanceName);
    setEditingName(false);
  }, [instance.instanceId, instance.instanceName]);

  const handleNameBlur = () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== instance.instanceName) {
      onRename(trimmed);
    } else {
      setNameValue(instance.instanceName);
    }
  };

  const result = connectivityResults.nim;
  const shouldShowBasicField = (path: string) => path === 'appKey' || path === 'account' || path === 'token';
  const shouldShowAdvancedField = (path: string) => !shouldShowBasicField(path) && path !== 'nimToken';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface border border-border-subtle p-1">
            <img
              src={PlatformRegistry.logo('nim')}
              alt="NIM"
              className="w-4 h-4 object-contain rounded"
            />
          </div>
          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameBlur();
                if (e.key === 'Escape') { setNameValue(instance.instanceName); setEditingName(false); }
              }}
              autoFocus
              className="text-sm font-medium text-foreground bg-transparent border-b border-primary focus:outline-none px-0 py-0"
            />
          ) : (
            <span
              className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors truncate border-b border-dashed border-gray-400 dark:border-secondary/50 hover:border-primary pb-px"
              onClick={() => setEditingName(true)}
              title={i18nService.t('imNimClickToRename')}
            >
              {instance.instanceName}
            </span>
          )}
        </div>

        <div className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
          instanceStatus?.connected
            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
            : 'bg-gray-500/15 text-gray-500 dark:text-gray-400'
        }`}>
          {instanceStatus?.connected ? i18nService.t('connected') : i18nService.t('disconnected')}
        </div>

        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={!instance.enabled && !(instance.nimToken || (instance.appKey && instance.account && instance.token))}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            instance.enabled
              ? (instanceStatus?.connected ? 'bg-green-500' : 'bg-yellow-500')
              : 'bg-gray-400 dark:bg-gray-600'
          } ${!instance.enabled && !(instance.nimToken || (instance.appKey && instance.account && instance.token)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          title={instance.enabled ? i18nService.t('imNimDisableInstance') : (!(instance.nimToken || (instance.appKey && instance.account && instance.token)) ? i18nService.t('imInstanceFillCredentials') : i18nService.t('imNimEnableInstance'))}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            instance.enabled ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
          title={i18nService.t('imNimDeleteInstance')}
        >
          <TrashIcon className="h-4 w-4" />
          {language === 'zh' ? '删除' : 'Delete'}
        </button>
      </div>

      <div className="mb-3 p-3 rounded-lg border border-dashed border-border-subtle">
        <ol className="text-xs text-secondary space-y-1 list-decimal list-inside">
          <li>{i18nService.t('nimGuideStep1')}</li>
          <li>{i18nService.t('nimGuideStep2')}</li>
          <li>{i18nService.t('nimGuideStep3')}</li>
          <li>{i18nService.t('nimGuideStep4')}</li>
        </ol>
      </div>

      {schemaData ? (
        <div className="space-y-3">
          <SchemaForm
            schema={schemaData.schema}
            hints={schemaData.hints}
            value={instance as unknown as Record<string, unknown>}
            includePath={(path) => shouldShowBasicField(path)}
            onChange={(path, value) => {
              const { instanceId: _instanceId, instanceName: _instanceName, ...raw } = instance;
              const updated = deepSet({ ...raw } as unknown as Record<string, unknown>, path, value);
              onConfigChange(updated as Partial<NimOpenClawConfig>);
            }}
            onBlur={() => void onSave()}
            showSecrets={showSecrets}
            onToggleSecret={(path) => setShowSecrets(prev => ({ ...prev, [path]: !prev[path] }))}
          />

          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-secondary hover:text-primary transition-colors">
              {i18nService.t('imAdvancedSettings')}
            </summary>
            <div className="mt-2 space-y-3 pl-2 border-l-2 border-border-subtle">
              <SchemaForm
                schema={schemaData.schema}
                hints={schemaData.hints}
                value={instance as unknown as Record<string, unknown>}
                includePath={(path) => shouldShowAdvancedField(path)}
                onChange={(path, value) => {
                  const { instanceId: _instanceId, instanceName: _instanceName, ...raw } = instance;
                  const updated = deepSet({ ...raw } as unknown as Record<string, unknown>, path, value);
                  onConfigChange(updated as Partial<NimOpenClawConfig>);
                }}
                onBlur={() => void onSave()}
                showSecrets={showSecrets}
                onToggleSecret={(path) => setShowSecrets(prev => ({ ...prev, [path]: !prev[path] }))}
              />
            </div>
          </details>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-secondary">
              {i18nService.t('nimAppKeyLabel')}
            </label>
            <input
              type="text"
              value={instance.appKey}
              onChange={(e) => onConfigChange({ appKey: e.target.value })}
              onBlur={() => void onSave()}
              className="block w-full rounded-lg bg-surface border-border-subtle border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-sm transition-colors"
              placeholder="your_app_key"
            />
            <p className="text-xs text-secondary">{i18nService.t('nimAppKeyHint')}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-secondary">
              {i18nService.t('nimAccountLabel')}
            </label>
            <input
              type="text"
              value={instance.account}
              onChange={(e) => onConfigChange({ account: e.target.value })}
              onBlur={() => void onSave()}
              className="block w-full rounded-lg bg-surface border-border-subtle border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-sm transition-colors"
              placeholder={i18nService.t('nimAccountPlaceholder')}
            />
            <p className="text-xs text-secondary">{i18nService.t('nimAccountHint')}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-secondary">
              {i18nService.t('nimTokenLabel')}
            </label>
            <div className="relative">
              <input
                type={showSecrets.token ? 'text' : 'password'}
                value={instance.token}
                onChange={(e) => onConfigChange({ token: e.target.value })}
                onBlur={() => void onSave()}
                className="block w-full rounded-lg bg-surface border-border-subtle border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 pr-16 text-sm transition-colors"
                placeholder="••••••••••••"
              />
              <div className="absolute right-2 inset-y-0 flex items-center gap-1">
                {instance.token && (
                  <button
                    type="button"
                    onClick={() => { onConfigChange({ token: '' }); void onSave({ token: '' }); }}
                    className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                    title={i18nService.t('clear') || 'Clear'}
                  >
                    <XCircleIconSolid className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSecrets(prev => ({ ...prev, token: !prev.token }))}
                  className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                  title={showSecrets.token ? (i18nService.t('hide') || 'Hide') : (i18nService.t('show') || 'Show')}
                >
                  {showSecrets.token ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-secondary">{i18nService.t('nimTokenHint')}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onTestConnectivity}
          disabled={testingPlatform === 'nim'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SignalIcon className="h-4 w-4" />
          {testingPlatform === 'nim' ? i18nService.t('testing') : i18nService.t('imConnectivityTest')}
        </button>
      </div>

      {instanceStatus?.botAccount && (
        <div className="text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">
          Account: {instanceStatus.botAccount}
        </div>
      )}

      {instanceStatus?.lastError && (
        <div className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
          {instanceStatus.lastError}
        </div>
      )}

      {result && (
        <div className={`text-xs px-3 py-2 rounded-lg ${
          result.verdict === 'pass'
            ? 'text-green-600 dark:text-green-400 bg-green-500/10'
            : result.verdict === 'warn'
              ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/10'
              : 'text-red-500 bg-red-500/10'
        }`}>
          {result.checks[0]?.message || i18nService.t('imConnectivityTest')}
        </div>
      )}
    </div>
  );
};

export default NimInstanceSettings;
