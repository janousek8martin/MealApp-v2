import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ShoppingScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('shopping.placeholderTitle')}
      subtitle={t('shopping.placeholderSubtitle')}
    />
  );
}
