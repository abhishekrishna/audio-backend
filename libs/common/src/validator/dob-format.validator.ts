import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsDobFormat(
  validationOptions?: ValidationOptions,
): (object: object, propertyName: string) => void {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDobFormat',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string): boolean {
          // Validate that the value is a valid date in the "dd/mm/yyyy" format
          const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
          return typeof value === 'string' && dateRegex.test(value);
        },
        defaultMessage(validationArguments?: ValidationArguments): string {
          return `${validationArguments?.property} must be a valid date in the "dd/mm/yyyy" format`;
        },
      },
    });
  };
}
