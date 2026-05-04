import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public decorator', () => {
  it('should set isPublic metadata to true', () => {
    class TestController {
      @Public()
      testMethod(this: void) {}
    }

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.testMethod);
    expect(metadata).toBe(true);
  });
});
