import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { isDeletedNickname } from '../utils/nickname';

/** Il nome da mostrare: quello vero, o "Utente eliminato" per un account cancellato. */
export function displayName(translate: Pick<TranslateService, 'instant'>, nickName: string): string {
  return isDeletedNickname(nickName) ? translate.instant('common.deleted-user') : nickName;
}

// `{{ user.nickName | userName }}`, dove puo' comparire chi ha cancellato
// l'account: spese, saldi, rimborsi, notifiche. Impura perche' segue la lingua
// scelta nel Profilo, come `money` e `amount`.
@Pipe({
  name: 'userName',
  standalone: true,
  pure: false,
})
export class UserNamePipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(nickName: string): string {
    return displayName(this.translate, nickName);
  }
}
