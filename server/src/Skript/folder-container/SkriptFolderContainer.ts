import { URI } from 'vscode-uri';
import { isRelativeURI } from '../../file_system/fileFunctions';
import { SkriptSectionGroup } from '../section/SkriptSectionGroup';
import type { SkriptFolder } from './SkriptFolder';

export class SkriptFolderContainer extends SkriptSectionGroup {
    override children: SkriptFolder[] = [];
    getSubFolderByUri(uri: URI): SkriptFolder | undefined {
        //const resolvedUri = resolveUri(uri);
        for (const f of this.children) {
            if (isRelativeURI(f.uri, uri)) {
                return f;
            }
            //const relativePath = path.relative(f.uri, uri);
            //if (URI.file(uri)  Utils.resolvePath(f.uri, uri)) {
            //    return f;
            //}
        }
        //return this.looseFolders;
        return undefined;
    }
    //recursive
    getFolderByUri(uri: URI): SkriptFolder | undefined {
        const subFolder = this.getSubFolderByUri(uri);
        if (subFolder) {
            const subSubFolder = subFolder.getFolderByUri(uri);
            return subSubFolder ?? subFolder;
        }
        return undefined;
    }
}