import {useContext, useCallback} from 'react';
import {SettingsContext} from '@/app/contexts/settings';
import {RadioGroup, RadioGroupItem} from '@/components/ui/radiogroup';

const ThemePicker = () => {
  const settings = useContext(SettingsContext);

  const setTheme = useCallback(
    (value: string) => {
      settings.handleUpdate({theme: value});
      const root = document.querySelector(':root');
      root && root.classList.remove('light', 'dark');
      root && root.classList.add(value);
      console.log('Theme changed to:', value);
    },
    [settings]
  );

  return (
    <RadioGroup
      value={settings.theme === 'light' ? 'light' : 'dark'}
      id="theme"
      onValueChange={setTheme}
    >
      <div className="flex items-center space-x-2">
        <RadioGroupItem
          className="border border-primary bg-white"
          value="light"
          id="light"
          aria-label="Light theme"
        />
        <RadioGroupItem
          className="border border-primary bg-[#0C1A3D]"
          value="dark"
          id="dark"
          aria-label="Dark theme"
        />
      </div>
    </RadioGroup>
  );
};

export default ThemePicker;
