# iOS 27: the large title jumps sideways when a stacked search bar becomes active

Minimal repro for react-native-screens: one native-stack screen with `headerLargeTitle` and
`headerSearchBarOptions: { placement: 'stacked', hideWhenScrolling: false }` over a `ScrollView`. Nothing else.

**On iOS 27**, tapping the search field draws the large title one layout margin to the **left** (x 22 → 2 on an
iPhone 17 Pro Max) for its first frames, and then slides it up from there. **On iOS 26.2** the same app slides the title
up from where it sits. The iOS 27 Settings app (large title + search) does not do it.

## Run

Xcode 27 (iOS 27 SDK) and an iOS 27 simulator or device:

```sh
npm install
npx expo run:ios            # or: npx expo run:ios --configuration Release
```

Tap the search field and watch "Markets". It lasts 1–2 frames, so a screen recording helps.

`app.json` enables `expo-build-properties`' `ios.enableSceneSupport`: an app built with the iOS 27 SDK that has not
adopted the scene lifecycle is refused at launch on iOS 27, unrelated to this bug.

## Measured

This app, Release builds, 60 fps simulator recordings (`simctl io recordVideo`), the left edge of "Markets":

| | at rest | first frames after the tap |
|---|---|---|
| iOS 27.0 (24A434), iPhone 17 Pro Max simulator, react-native-screens 4.28.0 | x 22 pt | **x 2 pt**, then slides up |
| same, react-native-screens 4.26.2 (Expo SDK 57's) | x 22 pt | **x 2 pt**, then slides up |
| iOS 26.2 (23C54), iPhone 17 Pro simulator, 4.28.0 | at its margin | stays at its margin, slides up |

Also seen on a physical iPhone 17 Pro Max (iOS 27.0) in another app with the same setup (Debug build).

## What happens (frame probe)

A `CADisplayLink` logging the large title label and its superviews from `searchBarShouldBeginEditing:` (in an app
with the same setup, iOS 27.0 and 26.2 simulators):

- the label lives in UIKit's `_UINavigationBarLargeTitleView`, whose superview is the screen's `RCTEnhancedScrollView`
  (on iOS 26.2 too);
- as the search becomes active, UIKit calls `-setDirectionalLayoutMargins:` on that view with **leading 0** (it was 20;
  the navigation bar's margins and the view controller's `systemMinimumLayoutMargins` stay 20) **before** it builds the
  title's slide-up, so the slide starts from x 0. On iOS 26.2 the view keeps its 16 throughout.

Tried, no change: `obscureBackground` true/false, `largeTitleDisplayMode = .automatic` instead of `.always`,
`definesPresentationContext = YES` on the screen, removing `[self becomeFirstResponder]` from
`searchBarTextDidBeginEditing:`, 20 pt layout margins on the scroll view, `hideWhenScrolling` default. Restoring the
margins or the label's frame after the fact does not help (the animation is already built from x 0).
`hideNavigationBar: false` avoids it, by not sliding the title away at all.

## Workaround (private API, for reference)

Refusing that zero for a moment after the search starts removes the jump — but it swizzles a private UIKit class, so it
is a stopgap, not a fix:

```objc
#import <objc/runtime.h>

static CFTimeInterval RNSKeepLargeTitleMarginsUntil = 0;

static void RNSGuardLargeTitleMarginsDuringSearchActivation(void)
{
  if (@available(iOS 27.0, *)) {
    static dispatch_once_t once;
    dispatch_once(&once, ^{
      Class cls = NSClassFromString(@"_UINavigationBarLargeTitleView");
      SEL sel = @selector(setDirectionalLayoutMargins:);
      Method method = cls != nil ? class_getInstanceMethod(cls, sel) : NULL;
      if (method == NULL) return;
      IMP original = method_getImplementation(method);
      IMP guarded = imp_implementationWithBlock(^(UIView *view, NSDirectionalEdgeInsets margins) {
        if (CACurrentMediaTime() < RNSKeepLargeTitleMarginsUntil && margins.leading == 0 &&
            view.directionalLayoutMargins.leading > 0) {
          margins.leading = view.directionalLayoutMargins.leading;
          if (margins.trailing == 0) margins.trailing = view.directionalLayoutMargins.trailing;
        }
        ((void (*)(id, SEL, NSDirectionalEdgeInsets))original)(view, sel, margins);
      });
      if (!class_addMethod(cls, sel, guarded, method_getTypeEncoding(method))) {
        method_setImplementation(method, guarded);
      }
    });
    RNSKeepLargeTitleMarginsUntil = CACurrentMediaTime() + 3.0;
  }
}

// in RNSSearchBar.mm
- (BOOL)searchBarShouldBeginEditing:(UISearchBar *)searchBar
{
  RNSGuardLargeTitleMarginsDuringSearchActivation();
  return YES;
}
```
