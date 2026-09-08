import React from 'react';
import { isMoneyMakerTask } from '../utils/taskUtils.js';

export default function MoneyMakerIcon({ task }) {
  if (!isMoneyMakerTask(task)) return null;
  return <span className="money-maker-icon" role="img" aria-label="Money maker" title="Money maker">💰</span>;
}
