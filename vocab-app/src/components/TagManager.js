/**
 * TagManager —— 单词标签管理底部弹出层
 *
 * - Modal 底部滑出，圆角白底面板 + 顶部拖拽指示条
 * - 已有标签以浅蓝胶囊展示，右侧 x 可删除
 * - TextInput 输入新标签回车或点添加按钮即可新增（自动 trim、去空）
 * - 点击背景遮罩关闭，KeyboardAvoidingView 适配键盘
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * @param {boolean} visible 是否显示
 * @param {() => void} onClose 关闭回调
 * @param {string[]} tags 当前标签列表
 * @param {(tag: string) => void} onAdd 新增标签回调
 * @param {(tag: string) => void} onRemove 删除标签回调
 */
export default function TagManager({ visible, onClose, tags = [], onAdd, onRemove }) {
  const [input, setInput] = useState('');

  /** 提交新增标签：trim 后非空才调用 onAdd 并清空输入框 */
  const handleSubmit = () => {
    const tag = input.trim();
    if (!tag) return;
    if (typeof onAdd === 'function') onAdd(tag);
    setInput('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* 键盘避让容器：整体靠底部排列 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* 背景遮罩：点击关闭 */}
        <Pressable style={styles.overlay} onPress={onClose} />
        {/* 底部圆角面板 */}
        <View style={styles.panel}>
          {/* 顶部拖拽指示条 */}
          <View style={styles.dragBar} />
          <Text style={styles.title}>自定义标签</Text>

          {/* 已有标签：横向自动换行的胶囊 */}
          <View style={styles.tagWrap}>
            {tags.length === 0 && <Text style={styles.empty}>暂无标签，在下方输入添加一个吧</Text>}
            {tags.map((tag) => (
              <View style={styles.chip} key={tag}>
                <Text style={styles.chipText}>{tag}</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => typeof onRemove === 'function' && onRemove(tag)}
                >
                  <Feather name="x" size={14} color="#4A90D9" />
                </Pressable>
              </View>
            ))}
          </View>

          {/* 输入 + 添加按钮 */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="输入新标签，如：高频词"
              placeholderTextColor="#9CA3AF"
              value={input}
              onChangeText={setInput}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Pressable style={styles.addButton} onPress={handleSubmit}>
              <Feather name="plus" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E9F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  empty: {
    fontSize: 13,
    color: '#9CA3AF',
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F1FA', // 浅蓝底
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#1D4ED8', // 深蓝字
  },
  addRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1F2937',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
