import '@mdview/core/styles/content.css';
import './workspace.css';
import { MDViewElectronViewer } from './viewer';

const viewer = new MDViewElectronViewer();
void viewer.initialize();
