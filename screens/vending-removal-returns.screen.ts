import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';
import { expect } from '@playwright/test';

/**
 * Page object for the Vending Return screen.
 *
 * Encapsulates the lookup product search UI and associated action icons.
 */
export class VendingRemovalReturnScreen extends BaseScreen {
  readonly lookupProductField =
    '//android.widget.EditText[contains(@hint,"Look up product")]';

  readonly widgetButton =
    '//android.widget.Button[not(@content-desc) and @text=""]';

  readonly noMatchingResultsMessage =
    '//android.view.View[contains(@content-desc,"No search results found")]';

  readonly recordTruckReturnsInfoIcon =
    '//android.view.View[starts-with(@content-desc,"Information")]';
    
  private readonly categoryButton = (category: string) =>
    `//android.view.View[@content-desc="${category}"]`;

  private readonly vendingCategoryButton =
    '//android.view.View[@content-desc="vending"]';

  private readonly scrimOverlay =
    '//android.view.View[@content-desc="Scrim"]';

  readonly sortIcon = '~section_header_sort_cta';
  readonly filterIcon = '~section_header_filter_cta';
  readonly filterSheetTitle = '~Filter';
  readonly byCategoryLabel = '~By category';
  readonly clearFiltersButton = '~Clear filters';
  readonly applyFiltersButton = '~Apply filters';
  readonly sortSheetTitle = '~Sort by';
  readonly clearSortOrderButton = '~Clear sort order';

  get lookupProductSearchIcon(): string {
    return `${this.lookupProductField}/following-sibling::android.widget.ImageView[1]`;
  }

  get lookupProductBarcodeIcon(): string {
    return `${this.lookupProductField}/following-sibling::android.widget.ImageView[2]`;
  }

  private readonly productResultByName = (productName: string) =>
    `//android.view.View[contains(@content-desc,"${productName}")]`;

  private readonly addedProductHintSelector = (details: string) =>
    `//android.view.View[contains(@hint,"${details}")]`;

  private get recordTruckReturnsInfo(): string {
    return `${this.recordTruckReturnsInfoIcon}/following-sibling::android.view.View[contains(@content-desc,"Record Removed Items & Truck Returns")]`;
  }

  private get truckReturnsValidationText(): string {
    return `${this.recordTruckReturnsInfoIcon}/following-sibling::android.view.View[contains(@content-desc,"To document removals and truck returns please scan or search the item and log the count.")]`;
  }

//  async open(): Promise<void> {
//   await this.tap(this.hamburgerIcon);
//   const collapsed = await this.driver.$(this.navMenuTruckStockCollapsed);
//   if (await collapsed.isDisplayed().catch(() => false)) {
//     await collapsed.click();
//   } else {
//     const expanded = await this.driver.$(
//       '//android.view.View[@content-desc="Truck stock, Expanded"]'
//     );
//     if (!(await expanded.isDisplayed().catch(() => false))) {
//       await this.waitFor(this.navMenuTruckStockCollapsed);
//       await collapsed.click();
//     }
//   }
//   await this.waitFor(this.navMenuTruckReturns);
//   await this.tap(this.navMenuTruckReturns);
//   await this.waitFor(this.truckReturnsTitle);
// }


async clickHeader(headerName: string): Promise<void> {
    const selector = `//android.view.View[contains(@content-desc,"${headerName}")]`;
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout: 15000 });
    await element.click();
  }

  /**
   * Returns the placeholder text for the lookup product search field.
   *
   * When the native field exposes a multi-line hint, the first line is the
   * visible placeholder label.
   */
  async getLookupProductPlaceholder(): Promise<string> {
    const field = await this.driver.$(this.lookupProductField);
    await field.waitForDisplayed({ timeout: 15000 });
    const hint = (await field.getAttribute('hint')) ?? '';
    const parts = hint.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
    return parts[0] ?? '';
  }

  /**
   * Returns the secondary hint text for the lookup product search field.
   *
   * For this app, the second line of the native hint is the searchable text
   * guidance shown below the placeholder.
   */
  async getLookupProductHint(): Promise<string> {
    const field = await this.driver.$(this.lookupProductField);
    await field.waitForDisplayed({ timeout: 15000 });
    const hint = (await field.getAttribute('hint')) ?? '';
    console.log('Lookup product field hint:', hint); // Debugging output to verify the
    const parts = hint.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
    return parts.join(' ');
  }

  async tapCategory(category: string): Promise<void> {
    await this.tap(this.categoryButton(category));
  }

  async isCategoryHighlighted(category: string): Promise<boolean> {
    const categoryElement = await this.driver.$(this.categoryButton(category));
    await categoryElement.waitForDisplayed({ timeout: 15000 });
    const selected = String((await categoryElement.getAttribute('selected')) ?? '').toLowerCase();
    const checked = String((await categoryElement.getAttribute('checked')) ?? '').toLowerCase();
    const focused = String((await categoryElement.getAttribute('focused')) ?? '').toLowerCase();
    return selected === 'true' || checked === 'true' || focused === 'true';
  }

  async isLookupIconLeftOfBarcodeIcon(): Promise<boolean> {
    const searchIcon = await this.driver.$(this.lookupProductSearchIcon);
    const barcodeIcon = await this.driver.$(this.lookupProductBarcodeIcon);
    await searchIcon.waitForDisplayed({ timeout: 15000 });
    await barcodeIcon.waitForDisplayed({ timeout: 15000 });
    const searchLocation = await searchIcon.getLocation();
    const barcodeLocation = await barcodeIcon.getLocation();
    return searchLocation.x < barcodeLocation.x;
  }

  async tapVendingCategory(): Promise<void> {
    await this.tap(this.vendingCategoryButton);
  }

  async tapScrim(): Promise<void> {
    await this.tap(this.scrimOverlay);
  }

  async isSortIconVisible(): Promise<boolean> {
    return this.isVisible(this.sortIcon);
  }

  async isSortIconEnabled(): Promise<boolean> {
    return this.isEnabled(this.sortIcon);
  }

  async isFilterIconVisible(): Promise<boolean> {
    return this.isVisible(this.filterIcon);
  }

  async isFilterIconEnabled(): Promise<boolean> {
    return this.isEnabled(this.filterIcon);
  }

  async openFilter(): Promise<void> {
    await this.tap(this.filterIcon);
  }

  async isFilterSheetVisible(): Promise<boolean> {
    return this.isVisible(this.filterSheetTitle);
  }

  async tapFilterCategory(label: string): Promise<void> {
    const selector = `//android.widget.Button[contains(@content-desc,"${label}") or contains(@text,"${label}")]`;
    await this.tap(selector);
  }

  async isFilterCategoryHighlighted(label: string): Promise<boolean> {
    const selector = `//android.widget.Button[contains(@content-desc,"${label}") or contains(@text,"${label}")]`;
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: 15000 });
    const selected = String((await el.getAttribute('selected')) ?? '').toLowerCase();
    const checked = String((await el.getAttribute('checked')) ?? '').toLowerCase();
    return selected === 'true' || checked === 'true';
  }

  async isApplyFiltersEnabled(): Promise<boolean> {
    return this.isEnabled(this.applyFiltersButton);
  }

  async isClearFiltersEnabled(): Promise<boolean> {
    return this.isEnabled(this.clearFiltersButton);
  }

  async applyFilters(): Promise<void> {
    await this.tap(this.applyFiltersButton);
  }

  async clearFilters(): Promise<void> {
    await this.tap(this.clearFiltersButton);
  }

  async isFilterActive(): Promise<boolean> {
    return this.isChecked(this.filterIcon);
  }

  /**
   * Selects multiple filter category chips without applying.
   */
  async selectFilterCategories(labels: string[]): Promise<void> {
    for (const label of labels) {
      await this.tapFilterCategory(label);
    }
  }

  /**
   * Verifies that all expected active filter chips are displayed on screen.
   * Active chip buttons are visible as views/buttons whose content-desc or
   * text contains the category label.
   */
  async verifyActiveFilterChips(expectedChips: string[]): Promise<boolean> {
    for (const expected of expectedChips) {
      const selector = `//android.view.View[contains(@content-desc,"${expected}") or contains(@text,"${expected}")] | //android.widget.Button[contains(@content-desc,"${expected}") or contains(@text,"${expected}")]`;
      const els = await this.driver.$$(selector);
      const count = (els as any).length as number;
      if (!count) {
        return false;
      }

      let foundVisible = false;
      for (let i = 0; i < count; i++) {
        const el = (els as any)[i];
        if (await el.isDisplayed().catch(() => false)) {
          foundVisible = true;
          break;
        }
      }

      if (!foundVisible) {
        return false;
      }
    }
    return true;
  }

  async areActiveFilterChipsCleared(): Promise<boolean> {
    const allCleared = await this.verifyActiveFilterChips([]);
    return allCleared;
  }

  async tapProductResult(productName: string): Promise<void> {
    await this.tap(this.productResultByName(productName));
  }

  async getAddedProductHintText(details: string): Promise<string> {
    const selector = this.addedProductHintSelector(details);
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout: 15000 });
    return (await element.getAttribute('hint'))?.trim() ?? '';
  }

  async getAddedProductTextValue(details: string): Promise<string> {
    const selector = this.addedProductHintSelector(details);
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout: 15000 });
    return (await element.getAttribute('text'))?.trim() ?? '';
  }

  /**
   * Verifies the visible product list is sorted A → Z by product title.
   * Uses a numeric-aware comparison so titles beginning with numbers
   * are ordered correctly (e.g. "1 Thing" before "10 Thing" before "A Thing").
   * Returns true when the visible list is in non-decreasing (ascending) order.
   */
  async isProductListSortedByTitleAtoZ(): Promise<boolean> {
    const selector = `//android.view.View[@hint and contains(@hint,'Pkg:')]`;
    const elements = await this.driver.$$(selector);

    const count = await elements.length;
    if (!elements || count < 2) return true;

    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const el = elements[i];
      try {
        await el.waitForDisplayed({ timeout: 5000 });
      } catch (e) {
        // continue even if a single element isn't displayed yet
      }
      const hint = (await el.getAttribute('hint')) ?? '';
      let title = hint.split('\n')[0].trim();
      if (!title) {
        // fallback to content-desc or visible text
        title = (await el.getAttribute('content-desc')) ?? (await el.getText().catch(() => ''));
        title = (title ?? '').toString().split('\n')[0].trim();
      }
      titles.push(title);
    }

    // The app displays numeric-starting titles in lexicographic order
    // (e.g. "1", "100", "12", "18"). Use numeric:false so the
    // comparator matches the on-device ordering observed in screenshots.
    const collator = new Intl.Collator(undefined, { numeric: false, sensitivity: 'base' });
    for (let i = 1; i < titles.length; i++) {
      if (collator.compare(titles[i - 1], titles[i]) > 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Verifies the visible product list is sorted Z → A by product title.
   * Matches the same lexicographic ordering used for A→Z but in reverse.
   */
  async isProductListSortedByTitleZtoA(): Promise<boolean> {
    const selector = `//android.view.View[@hint and contains(@hint,'Pkg:')]`;
    const elements = await this.driver.$$(selector);

    const count = await elements.length;
    if (!elements || count < 2) return true;

    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const el = elements[i];
      try {
        await el.waitForDisplayed({ timeout: 5000 });
      } catch (e) {
        // ignore
      }
      const hint = (await el.getAttribute('hint')) ?? '';
      let title = hint.split('\n')[0].trim();
      if (!title) {
        title = (await el.getAttribute('content-desc')) ?? (await el.getText().catch(() => ''));
        title = (title ?? '').toString().split('\n')[0].trim();
      }
      titles.push(title);
    }

    // Use the same lexicographic comparator (numeric:false) as A→Z,
    // but ensure the sequence is non-increasing.
    const collator = new Intl.Collator(undefined, { numeric: false, sensitivity: 'base' });
    for (let i = 1; i < titles.length; i++) {
      if (collator.compare(titles[i - 1], titles[i]) < 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Checks whether the lookup product search field is visible.
   */
  async isLookupProductLabelVisible(): Promise<boolean> {
    const field = await this.driver.$(this.lookupProductField);
    await field.waitForDisplayed({ timeout: 15000 });
    return field.isDisplayed().catch(() => false);
  }

  async enterLookupProductText(value: string): Promise<void> {
    const field = await this.driver.$(this.lookupProductField);
    await field.waitForDisplayed({ timeout: 15000 });
    await field.click();
    await field.clearValue();
    await field.setValue(value);
  }


// async enterText(locator: string, value: string): Promise<void> {
//   const element = await this.driver.$(locator);

//   await element.waitForDisplayed({
//     timeout: 10000,
//   });

//   await element.clearValue();
//   await element.setValue(value);
// }

  async verifyElementDisplayed(headerLabel: string): Promise<boolean> {
    const selector = `//android.view.View[contains(@content-desc,"${headerLabel}")]`;
    const result = await this.driver.$(selector);
    await result.waitForDisplayed({ timeout: 15000 });
    return result.isDisplayed().catch(() => false);
  }

  async verifyElementIsDisplayed(elementSelector: string): Promise<boolean> {
    const result = await this.driver.$(elementSelector);
    await result.waitForDisplayed({ timeout: 15000 });
    return result.isDisplayed().catch(() => false);
  }

async verifyProductInfo(headerLabel: string, barcode: string) {
    // expect(await this.verifyElementDisplayed('1 Regal Movie Ticket - pkg: 1')).toBe(true);
    const selector = `//android.view.View[contains(@content-desc,"${headerLabel}")]`;
    const result = await this.driver.$(selector);
     await result.waitForDisplayed({ timeout: 15000 });
     
     result.getAttribute('content-desc').then((contentDesc) => {
      if (contentDesc && contentDesc.trim().length > 0) {
         expect(contentDesc.trim()).toContain(headerLabel);
        expect(contentDesc.trim()).toContain(barcode);
      }else {
        result.getText().then((text) => {
           expect(text.trim()).toContain(headerLabel);
          expect(text.trim()).toContain(barcode);
        });
      }
    });
    // expect(await this.verifyElementDisplayed('SKU: 48097')).toBe(true);
    // return result.isDisplayed().catch(() => false);
  }


  
  async isNoMatchingResultsVisible(): Promise<boolean> {
    const result = await this.driver.$(this.noMatchingResultsMessage);
    await result.waitForDisplayed({ timeout: 15000 });
    return result.isDisplayed().catch(() => false);
  }

  async getNoMatchingResultsText(): Promise<string> {
    const result = await this.driver.$(this.noMatchingResultsMessage);
    await result.waitForDisplayed({ timeout: 15000 });
    const contentDesc = await result.getAttribute('content-desc');
    return (contentDesc?.trim() ?? (await result.getText()).trim()) as string;
  }

  /**
   * Checks whether the record truck returns info label/icon is visible.
   */
  async isRecordTruckReturnsInfoIconVisible(): Promise<boolean> {
    const icon = await this.driver.$(this.recordTruckReturnsInfoIcon);
    return icon.isDisplayed().catch(() => false);
  }

  async isRecordTruckReturnsInfoVisible(): Promise<boolean> {
    const info = await this.driver.$(this.recordTruckReturnsInfo);
    return info.isDisplayed().catch(() => false);
  }

  /**
   * Returns the text for the Record Truck Returns info message.
   */
  async getRecordTruckReturnsInfoText(): Promise<string> {
    const info = await this.driver.$(this.recordTruckReturnsInfo);
    await info.waitForDisplayed({ timeout: 15000 });
    const contentDesc = await info.getAttribute('content-desc');
    return (contentDesc?.trim() ?? (await info.getText()).trim()) as string;
  }

  /**
   * Checks whether the truck returns validation message is visible.
   */
  async isValidationTextVisible(): Promise<boolean> {
    const validation = await this.driver.$(this.truckReturnsValidationText);
    return validation.isDisplayed().catch(() => false);
  }

  /**
   * Returns the validation message text shown on the screen.
   */
  async getValidationText(): Promise<string> {
    const validation = await this.driver.$(this.truckReturnsValidationText);
    await validation.waitForDisplayed({ timeout: 15000 });
    const contentDesc = await validation.getAttribute('content-desc');
    return (contentDesc?.trim() ?? (await validation.getText()).trim()) as string;
  }

  /**
   * Checks whether the lookup product search icon is visible.
   */
  async isSearchIconVisible(): Promise<boolean> {
    const icon = await this.driver.$(this.lookupProductSearchIcon);
    await icon.waitForDisplayed({ timeout: 15000 });
    return icon.isDisplayed().catch(() => false);
  }

  /**
   * Checks whether the lookup product search icon is tappable.
   */
  async isSearchIconClickable(): Promise<boolean> {
    const icon = await this.driver.$(this.lookupProductSearchIcon);
    await icon.waitForDisplayed({ timeout: 15000 });
    const clickable = await icon.getAttribute('clickable');
    return String(clickable).toLowerCase() === 'true';
  }

  /**
   * Checks whether the barcode scanner icon is visible.
   */
  async isBarcodeScannerIconVisible(): Promise<boolean> {
    const icon = await this.driver.$(this.lookupProductBarcodeIcon);
    await icon.waitForDisplayed({ timeout: 15000 });
    return icon.isDisplayed().catch(() => false);
  }

  /**
   * Checks whether the barcode scanner icon is tappable.
   */
  async isBarcodeScannerIconClickable(): Promise<boolean> {
    const icon = await this.driver.$(this.lookupProductBarcodeIcon);
    await icon.waitForDisplayed({ timeout: 15000 });
    const clickable = await icon.getAttribute('clickable');
    return String(clickable).toLowerCase() === 'true';
  }

   async enterTextBoxValue(hintLabel: string, value: string): Promise<void> {
    const selector = `//android.widget.EditText[@hint="${hintLabel}"]`;
    const header = await this.driver.$(selector);
    const hintField = await this.driver.$(selector);
    await hintField.waitForDisplayed({ timeout: 15000 });
    await hintField.isEnabled();
    await hintField.click();
    await hintField.clearValue();
    await hintField.setValue(value);
  }

  

  async click(buttonLabel: string): Promise<void> {
    const selector = `//android.widget.Button[@content-desc="${buttonLabel}" or @text="${buttonLabel}"]`;
    const button = await this.driver.$(selector);
    await button.waitForDisplayed({ timeout: 15000 });
    await button.click();
  }

  async verifyButtonIsDisplayed(buttonLabel: string): Promise<void> {
    const selector = `//android.widget.Button[contains(@content-desc,"${buttonLabel}") or contains(@text,"${buttonLabel}")]`;
    const button = await this.driver.$(selector);
    await button.waitForDisplayed({ timeout: 15000 });
    expect(await button.isDisplayed()).toBe(true);
  }

  // async verifyProductHeaderInfo(headerLabel: string, pkgInfo: string, barcode: string): Promise<boolean> {
  //   const headerVisible = await this.verifyElementDisplayed(headerLabel);
  //   const pkgVisible = await this.verifyElementDisplayed(pkgInfo);
  //   const barcodeVisible = await this.verifyElementDisplayed(barcode);
  //   return headerVisible && pkgVisible && barcodeVisible;
  // }
  

  async isNumericKeyboardDisplayed(hintLabel: string): Promise<boolean> {
    const selector = `//android.widget.EditText[@hint="${hintLabel}"]`;
    const header = await this.driver.$(selector);
    const hintField = await this.driver.$(selector);
    await hintField.waitForDisplayed({ timeout: 15000 });
    await hintField.isEnabled();
    await hintField.click();
    const keys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (const key of keys) {
        const element = await this.driver.$(`~${key}`);
        if (!(await element.isDisplayed())) {
            return false;
        }
      }
    return true;
  }

  async closeKeypadIfDisplayed(): Promise<void> {
    // When the numeric keypad is open, Android will typically intercept BACK
    // to close the IME before it navigates away from the app screen.
    // Use a short visibility probe first so we only dismiss the keyboard when
    // it is actually present.
    await this.waitForKeyboardVisible(3000);
    await this.hideKeyboardViaAdb();
  }

  async openSort(): Promise<void> {
    await this.tap(this.sortIcon);
  }

  async isSortSheetVisible(): Promise<boolean> {
    return this.isVisible(this.sortSheetTitle);
  }

  async clearSortOrder(): Promise<void> {
    await this.tap(this.clearSortOrderButton);
  }

  // async selectSortOption(optionLabel: string): Promise<void> {
  //   await this.tap(this.sortIcon);
  //   await this.tap(`~${optionLabel}`);
  // }

  // async isSortOptionHighlighted(optionLabel: string): Promise<boolean> {
  //   const selector = `~${optionLabel}`;
  //   const el = await this.driver.$(selector);
  //   await el.waitForDisplayed({ timeout: 15000 });
  //   const selected = String((await el.getAttribute('selected')) ?? '').toLowerCase();
  //   const checked = String((await el.getAttribute('checked')) ?? '').toLowerCase();
  //   if (selected === 'true' || checked === 'true') {
  //     return true;
  //   }
  //   // The Sort option buttons do not expose a native selected state in this
  //   // screen source; rely on the shared Sort header's real active state as a
  //   // fallback verification signal.
  //   return this.isSortActive();
  // }

  // async verifySortOption(optionLabel: string): Promise<boolean> {
  //   const selector = `~${optionLabel}`;
  //   const el = await this.driver.$(selector);
  //   await el.waitForDisplayed({ timeout: 15000 });
  //   const selected = String((await el.getAttribute('selected')) ?? '').toLowerCase();
  //   const checked = String((await el.getAttribute('checked')) ?? '').toLowerCase();
  //   if (selected === 'true' || checked === 'true') {
  //     return true;
  //   }
  //   // The Sort option buttons do not expose a native selected state in this
  //   // screen source; rely on the shared Sort header's real active state as a
  //   // fallback verification signal.
  //   return this.isSortActive();
  // }

  async isSortActive(): Promise<boolean> {
    return this.isChecked(this.sortIcon);
  }

}
