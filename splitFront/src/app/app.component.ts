import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import {
    TranslateService,
    TranslatePipe,
    TranslateDirective
} from "@ngx-translate/core";

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, TranslatePipe, TranslateDirective],
})
export class AppComponent {
  private translate = inject(TranslateService);

    constructor() {
        this.translate.addLangs(['it', 'en']);
        this.translate.setFallbackLang('en');
        this.translate.use('en');
    }
}
