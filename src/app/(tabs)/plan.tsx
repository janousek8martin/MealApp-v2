import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function PlanScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('plan.placeholderTitle')}
      subtitle={t('plan.placeholderSubtitle')}
    />
  );
}
