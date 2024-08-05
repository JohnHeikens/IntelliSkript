/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	createConnection
} from 'vscode-languageserver/node';
import { Server } from './server';

const connection = createConnection();
connection.console.info(`Sample server running in node ${process.version}`);

//run server.ts
new Server(connection);