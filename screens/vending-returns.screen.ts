import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';

/**
 * Page object for the Vending Return screen.
 *
 * Encapsulates the lookup product search UI and associated action icons.
 */
export class VendingReturnScreen extends BaseScreen {
  private readonly lookupProductField =
    '//android.widget.EditText[contains(@hint,"Look up product")]';

  private get lookupProductSearchIcon(): string {
    return `${this.lookupProductField}/following-sibling::android.widget.ImageView[1]`;
  }

  private get lookupProductBarcodeIcon(): string {
    return `${this.lookupProductField}/following-sibling::android.widget.ImageView[2]`;
  }

  private readonly recordTruckReturnsInfo =
    '//android.view.View[contains(@content-desc,"Record Individual Truck Returns")]';

  private readonly truckReturnsValidationText =
    '//android.view.View[contains(@content-desc,"This service stop does not have requested truck returns. Please add truck returns individually to accurately reflect inventory")]';

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
    console.log('Lookup product field value text:', await field.getAttribute('extras'));
    console.log('Lookup product field value text:', await field.getAttribute('name'));
    console.log('Lookup product field hint text:', await field.getAttribute('placeholderValue')); // Debugging output to verify the
    console.log('Lookup product field title:', await field.getTitle()); // Debugging output to verify the
    console.log('Lookup product field tag name:', await field.getTagName()); // Debugging output to verify the
    const text = await field.getText();
    console.log('Lookup product field text:', text);
    const parts = hint.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
    return parts.slice(1).join(' ') ?? '';
  }

  /**
   * Checks whether the lookup product search field is visible.
   */
  async isLookupProductLabelVisible(): Promise<boolean> {
    const field = await this.driver.$(this.lookupProductField);
    await field.waitForDisplayed({ timeout: 15000 });
    return field.isDisplayed().catch(() => false);
  }
  
  /**
   * Checks whether the record truck returns info label/icon is visible.
   */
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
}
