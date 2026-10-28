import { computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { DOQ_DEFAULT_MESSAGES, DOQ_I18N_ADAPTER, type DoqMessageKey } from '@doqs/analog';

const spanish: Partial<Record<DoqMessageKey, string>> = {
  'documentation.label': 'Documentación',
  'documentation.breadcrumbRoot': 'Documentación',
  'nav.menu': 'Menú de {label}',
  'nav.close': 'Cerrar navegación',
  'nav.overview': 'Resumen',
  'toc.title': 'En esta página',
  'pagination.previous': 'Anterior',
  'pagination.next': 'Siguiente',
  'search.trigger': 'Buscar',
  'search.dialogTitle': 'Buscar documentación',
  'search.label': 'Buscar en la documentación',
  'search.placeholder': 'Buscar documentación',
  'search.close': 'Cerrar',
  'version.prefix': 'Versión',
  'locale.prefix': 'Idioma',
  'locale.listLabel': 'Idiomas de la documentación',
};

const arabic: Partial<Record<DoqMessageKey, string>> = {
  'documentation.label': 'التوثيق',
  'documentation.breadcrumbRoot': 'التوثيق',
  'nav.menu': 'قائمة {label}',
  'nav.close': 'إغلاق التنقل',
  'nav.overview': 'نظرة عامة',
  'toc.title': 'في هذه الصفحة',
  'pagination.previous': 'السابق',
  'pagination.next': 'التالي',
  'search.trigger': 'بحث',
  'search.dialogTitle': 'البحث في التوثيق',
  'search.label': 'البحث في التوثيق',
  'search.placeholder': 'ابحث في التوثيق',
  'search.close': 'إغلاق',
  'version.prefix': 'الإصدار',
  'locale.prefix': 'اللغة',
  'locale.listLabel': 'لغات التوثيق',
};

/** A provider-neutral, URL-derived host adapter used to exercise reactive localized chrome. */
export const provideShowcaseDoqI18n = {
  provide: DOQ_I18N_ADAPTER,
  useFactory: () => {
    const router = inject(Router);
    const url = toSignal(
      router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map(() => router.url),
      ),
      { initialValue: router.url },
    );
    const locale = computed(() => {
      const first = url().split(/[?#]/, 1)[0]?.split('/').filter(Boolean)[0];
      return first === 'es' || first === 'ar' ? first : 'en';
    });
    return {
      locale,
      direction: computed(() => locale() === 'ar' ? 'rtl' as const : 'ltr' as const),
      translate: (key: string, fallback: string) => {
        const translated = locale() === 'es' ? spanish[key as DoqMessageKey] : locale() === 'ar' ? arabic[key as DoqMessageKey] : undefined;
        return translated ?? fallback ?? DOQ_DEFAULT_MESSAGES[key as DoqMessageKey] ?? key;
      },
      // Doqs owns the locale-prefixed routes in this fixture. The host adapter explicitly does not.
      localize: (path: string) => path,
      ownsRouting: false,
      ownsHead: false,
    };
  },
};
