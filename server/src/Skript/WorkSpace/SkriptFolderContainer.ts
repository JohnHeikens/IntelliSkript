import path = require('path');
import { SkriptSectionGroup } from '../Section/SkriptSectionGroup';
import type { SkriptFolder } from './SkriptFolder';

export class SkriptFolderContainer extends SkriptSectionGroup {
    override children: SkriptFolder[] = [];
    getSubFolderByUri(uri: string): SkriptFolder | undefined {
        //const resolvedUri = resolveUri(uri);
        for (const f of this.children) {
            const relativePath = path.relative(f.uri, uri);
            if (!relativePath.startsWith('.')) {
                return f;
            }
        }
        //return this.looseFolders;
        return undefined;
    }
    //recursive
    getFolderByUri(uri: string): SkriptFolder | undefined {
        const subFolder = this.getSubFolderByUri(uri);
        if (subFolder) {
            const subSubFolder = subFolder.getFolderByUri(uri);
            return subSubFolder ?? subFolder;
        }
        return undefined;
    }
}