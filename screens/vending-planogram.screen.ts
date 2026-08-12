import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';
import { expect } from '@playwright/test';

/**
 * Page object for the Vending Return screen.
 *
 * Encapsulates the lookup product search UI and associated action icons.
 */
export class VendingPlanogramScreen extends BaseScreen {
  readonly sortIcon = '~section_header_sort_cta';
  readonly filterIcon = '~section_header_filter_cta';
  readonly filterSheetTitle = '~Filter';
  readonly byCategoryLabel = '~By category';
  readonly clearFiltersButton = '~Clear filters';
  readonly applyFiltersButton = '~Apply filters';
  readonly sortSheetTitle = '~Sort by';
  readonly clearSortOrderButton = '~Clear sort order';

  readonly layoutToggle = '//android.view.View[contains(@content-desc,"Label name")]/following-sibling::android.widget.ImageView';
  readonly labelNameDropdown = '//android.view.View[contains(@content-desc,"Label name")]';
  readonly parCapacityHeader = '//android.view.View[contains(@content-desc,"Par / Capacity")]';
  readonly parCapacityRowSelector = '//android.view.View[starts-with(@content-desc,"Row ") and contains(@content-desc,"Par") and contains(@content-desc,"Cap")]';

  async isGridLayoutToggleVisible(): Promise<boolean> {
    return this.isVisible(this.layoutToggle);
  }

  async isListLayoutToggleVisible(): Promise<boolean> {
    return this.isVisible(this.layoutToggle);
  }

  async isParCapacityHeaderVisible(): Promise<boolean> {
    return this.isVisible(this.parCapacityHeader);
  }

  async isParFieldVisible(): Promise<boolean> {
    return this.isVisible(`${this.parCapacityRowSelector}[contains(@content-desc,"Par")]`);
  }

  async isParValueDisplayed(value: string): Promise<boolean> {
    const selector = `${this.parCapacityRowSelector}[contains(@content-desc,"Par") and contains(@content-desc,"${value}")]`;
    return this.isVisible(selector);
  }

  async getParCapacityRowStrings(): Promise<string[]> {
    const elements = await this.driver.$$(this.parCapacityRowSelector);
    const count = await elements.length;
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      const el = elements[i];
      const raw = (await el.getAttribute('content-desc'))?.trim() ?? '';
      if (raw) {
        values.push(raw);
      }
    }
    return values;
  }

  async switchToGridView(): Promise<void> {
    await this.tap(this.layoutToggle);
  }

  async switchToListView(): Promise<void> {
    await this.tap(this.layoutToggle);
  }

  async openLabelNameDropdown(): Promise<void> {
    await this.tap(this.labelNameDropdown);
  }

  async selectLabelNameOption(option: string): Promise<void> {
    await this.tap(`//android.widget.Button[contains(@content-desc,"${option}")]`);
  }

  // async isLabelNameOptionSelected(option: string): Promise<boolean> {
  //   const selector = `//android.widget.View[contains(@content-desc,"${option}")]`;
  //   const element = await this.driver.$(selector);
  //   await element.waitForDisplayed({ timeout: 15000 });
  //   const selected = String((await element.getAttribute('selected')) ?? '').toLowerCase();
  //   const checked = String((await element.getAttribute('checked')) ?? '').toLowerCase();
  //   const focused = String((await element.getAttribute('focused')) ?? '').toLowerCase();
  //   return selected === 'true' || checked === 'true' || focused === 'true';
  // }

  async isLabelNameValueDisplayed(option: string): Promise<boolean> {
    const selector = `//android.view.View[contains(@content-desc,"${option}") and contains(@content-desc,"Label name")]`;
    return this.isVisible(selector);
  }
}
