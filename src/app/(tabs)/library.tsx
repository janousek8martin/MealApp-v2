import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function LibraryScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('library.placeholderTitle')}
      subtitle={t('library.placeholderSubtitle')}
    />
  );
}
