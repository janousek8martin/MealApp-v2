import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ProgressScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('progress.placeholderTitle')}
      subtitle={t('progress.placeholderSubtitle')}
    />
  );
}
